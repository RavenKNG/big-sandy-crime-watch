import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { FACEBOOK_GRAPH_ROOT, saveFacebookConnection } from "@/lib/facebook-connection";
import { verifyFacebookPageToken } from "@/lib/facebook-token-health";

type OAuthToken = { access_token?: string; error?: { message?: string } };
type AccountList = { data?: Array<{ id?: string; name?: string; tasks?: string[]; access_token?: string }>; error?: { message?: string } };

function connectUrl(request: Request, params: Record<string, string>) {
  const baseUrl = process.env.SITE_URL || request.url;
  const url = new URL("/admin/facebook/connect", baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("facebook_oauth_state")?.value;
  cookieStore.delete("facebook_oauth_state");
  if (!code || !state || !expectedState || state !== expectedState) return NextResponse.redirect(connectUrl(request, { error: "OAuth state validation failed." }));

  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  const expectedPageName = process.env.FACEBOOK_PAGE_NAME || "Big Sandy Crime Watch";
  if (!appId || !appSecret || !redirectUri) return NextResponse.redirect(connectUrl(request, { error: "Facebook OAuth server configuration is incomplete." }));

  const shortExchange = new URL(`${FACEBOOK_GRAPH_ROOT}/oauth/access_token`);
  shortExchange.searchParams.set("client_id", appId);
  shortExchange.searchParams.set("client_secret", appSecret);
  shortExchange.searchParams.set("redirect_uri", redirectUri);
  shortExchange.searchParams.set("code", code);
  const shortResponse = await fetch(shortExchange);
  const shortJson = await shortResponse.json() as OAuthToken;
  if (!shortResponse.ok || !shortJson.access_token) return NextResponse.redirect(connectUrl(request, { error: "Facebook authorization-code exchange failed." }));

  const longExchange = new URL(`${FACEBOOK_GRAPH_ROOT}/oauth/access_token`);
  longExchange.searchParams.set("grant_type", "fb_exchange_token");
  longExchange.searchParams.set("client_id", appId);
  longExchange.searchParams.set("client_secret", appSecret);
  longExchange.searchParams.set("fb_exchange_token", shortJson.access_token);
  const longResponse = await fetch(longExchange);
  const longJson = await longResponse.json() as OAuthToken;
  if (!longResponse.ok || !longJson.access_token) return NextResponse.redirect(connectUrl(request, { error: "Long-lived Facebook user-token exchange failed." }));

  const accountsResponse = await fetch(`${FACEBOOK_GRAPH_ROOT}/me/accounts?fields=id,name,tasks,access_token`, { headers: { Authorization: `Bearer ${longJson.access_token}` } });
  const accountsJson = await accountsResponse.json() as AccountList;
  const page = accountsJson.data?.find((item) => item.name === expectedPageName || item.id === process.env.FACEBOOK_PAGE_ID);
  if (!accountsResponse.ok || !page?.id || !page.name || !page.access_token) return NextResponse.redirect(connectUrl(request, { error: "The configured Facebook Page was not returned by /me/accounts." }));
  if (!page.tasks?.some((task) => task === "CREATE_CONTENT" || task === "MANAGE")) return NextResponse.redirect(connectUrl(request, { error: "The returned Page connection does not include a content-publishing task." }));

  await saveFacebookConnection({ pageId: page.id, pageName: page.name, pageToken: page.access_token });
  await verifyFacebookPageToken();
  return NextResponse.redirect(connectUrl(request, { connected: "1" }));
}
