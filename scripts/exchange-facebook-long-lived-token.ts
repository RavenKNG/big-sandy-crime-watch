import { verifyFacebookPageToken } from "../src/lib/facebook-token-health";

const GRAPH_ROOT = "https://graph.facebook.com/v25.0";
const PAGE_ID = "1179654975227785";

async function main() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const userToken = process.env.FACEBOOK_USER_ACCESS_TOKEN;
  if (!appId || !appSecret || !userToken) {
    throw new Error(
      "META_APP_ID, META_APP_SECRET, and FACEBOOK_USER_ACCESS_TOKEN are required. Pass secrets through environment variables, not CLI arguments.",
    );
  }

  const exchange = new URL(`${GRAPH_ROOT}/oauth/access_token`);
  exchange.searchParams.set("grant_type", "fb_exchange_token");
  exchange.searchParams.set("client_id", appId);
  exchange.searchParams.set("client_secret", appSecret);
  exchange.searchParams.set("fb_exchange_token", userToken);
  const exchangeResponse = await fetch(exchange);
  const exchangeJson = (await exchangeResponse.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!exchangeResponse.ok || !exchangeJson.access_token) {
    throw new Error(exchangeJson.error?.message || "Meta long-lived user-token exchange failed.");
  }

  const accounts = await fetch(
    `${GRAPH_ROOT}/me/accounts?fields=id,name,tasks,access_token`,
    { headers: { Authorization: `Bearer ${exchangeJson.access_token}` } },
  );
  const accountsJson = (await accounts.json()) as {
    data?: Array<{ id?: string; name?: string; tasks?: string[]; access_token?: string }>;
  };
  const page = accountsJson.data?.find((item) => item.id === PAGE_ID);
  if (!page?.access_token) throw new Error("Big Sandy Crime Watch Page token was not returned.");

  process.env.FACEBOOK_PAGE_ID = PAGE_ID;
  process.env.FACEBOOK_PAGE_ACCESS_TOKEN = page.access_token;
  process.env.FACEBOOK_TOKEN_STRATEGY = "page_token";
  const health = await verifyFacebookPageToken();
  console.log(
    JSON.stringify(
      {
        exchanged: true,
        pageTokenReturned: true,
        userTokenExpiresInSeconds: exchangeJson.expires_in,
        pageIdentity: page.name,
        pageTasks: page.tasks,
        verification: health,
        actionRequired:
          "Store the returned Page token securely as FACEBOOK_PAGE_ACCESS_TOKEN. The token value is intentionally not printed.",
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
