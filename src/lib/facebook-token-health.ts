const GRAPH_ROOT = "https://graph.facebook.com/v25.0";
const EXPECTED_PAGE_NAME = "Big Sandy Crime Watch";

type GraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type DebugTokenResponse = GraphError & {
  data?: {
    app_id?: string;
    application?: string;
    type?: string;
    expires_at?: number;
    data_access_expires_at?: number;
    is_valid?: boolean;
    scopes?: string[];
  };
};

function isoTimestamp(value?: number): string | undefined {
  return value && value > 0
    ? new Date(value * 1000).toISOString()
    : undefined;
}

function safeGraphError(json: GraphError) {
  return {
    message: json.error?.message,
    type: json.error?.type,
    code: json.error?.code,
    errorSubcode: json.error?.error_subcode,
  };
}

async function graphJson<T extends GraphError>(
  url: string,
  token: string,
): Promise<{ ok: boolean; json: T }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { ok: response.ok, json: (await response.json()) as T };
}

export async function verifyFacebookPageToken() {
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!pageId || !pageToken) {
    return {
      healthy: false,
      configured: false,
      actionRequired: "Configure the Facebook Page ID and Page access token.",
    };
  }

  const me = await graphJson<GraphError & { id?: string; name?: string }>(
    `${GRAPH_ROOT}/me?fields=id,name`,
    pageToken,
  );
  if (!me.ok) {
    return {
      healthy: false,
      configured: true,
      pageIdMatched: false,
      actionRequired: "Replace the invalid or expired Facebook Page access token.",
      error: safeGraphError(me.json),
    };
  }

  const debug = await graphJson<DebugTokenResponse>(
    `${GRAPH_ROOT}/debug_token?input_token=${encodeURIComponent(pageToken)}`,
    pageToken,
  );
  const metadata = debug.json.data;
  const scopes = metadata?.scopes ?? [];
  const expiresAt = isoTimestamp(metadata?.expires_at);
  const dataAccessExpiresAt = isoTimestamp(metadata?.data_access_expires_at);
  const expiresSoon =
    Boolean(metadata?.expires_at) &&
    metadata!.expires_at! * 1000 < Date.now() + 7 * 24 * 60 * 60 * 1000;
  const pageIdMatched = me.json.id === pageId;
  const pageNameMatched = me.json.name === EXPECTED_PAGE_NAME;
  const postingScopePresent = scopes.includes("pages_manage_posts");
  const type = metadata?.type ?? "UNKNOWN";
  const healthy =
    pageIdMatched &&
    pageNameMatched &&
    debug.ok &&
    metadata?.is_valid === true &&
    type === "PAGE" &&
    postingScopePresent;

  return {
    healthy,
    configured: true,
    pageIdMatched,
    pageNameMatched,
    pageName: me.json.name,
    tokenType: type,
    appIdPresent: Boolean(metadata?.app_id),
    application: metadata?.application,
    debugTokenAvailable: debug.ok,
    expiresAt,
    dataAccessExpiresAt,
    expiresSoon,
    postingScopePresent,
    scopes,
    actionRequired: !healthy
      ? "Replace the invalid Facebook Page access token."
      : expiresSoon
        ? `Replace or renew the Facebook Page access token before ${expiresAt}.`
        : undefined,
    error: debug.ok ? undefined : safeGraphError(debug.json),
  };
}
