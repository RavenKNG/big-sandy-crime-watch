import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { FACEBOOK_SCOPES } from "@/lib/facebook-connection";

export async function GET() {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI;
  if (!appId || !redirectUri) return new NextResponse("Facebook OAuth is not configured.", { status: 503 });
  const state = crypto.randomBytes(32).toString("base64url");
  const url = new URL("https://www.facebook.com/v25.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", FACEBOOK_SCOPES.join(","));
  const response = NextResponse.redirect(url);
  response.cookies.set("facebook_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/admin/facebook/callback" });
  return response;
}
