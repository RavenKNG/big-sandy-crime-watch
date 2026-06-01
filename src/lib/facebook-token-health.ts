import { FACEBOOK_GRAPH_ROOT, getFacebookCredential, updateFacebookConnectionHealth } from "./facebook-connection";

const EXPECTED_PAGE_NAME = process.env.FACEBOOK_PAGE_NAME || "Big Sandy Crime Watch";

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
  const credential = await getFacebookCredential();
  if (!credential) {
    return {
      healthy: false,
      configured: false,
      tokenStrategy: "page_token",
      actionRequired: "Configure the Facebook Page ID and posting access token.",
    };
  }
  const { pageId, pageToken, source } = credential;

  const me = await graphJson<GraphError & { id?: string; name?: string }>(
    `${FACEBOOK_GRAPH_ROOT}/me?fields=id,name`,
    pageToken,
  );
  if (!me.ok) {
    const result = {
      healthy: false,
      configured: true,
      tokenStrategy: "page_token",
      credentialSource: source,
      pageIdMatched: false,
      actionRequired: "Replace the invalid or expired Facebook Page access token.",
      error: safeGraphError(me.json),
    };
    await updateFacebookConnectionHealth({ status: "INVALID", error: result.error });
    return result;
  }

  const debug = await graphJson<DebugTokenResponse>(
    `${FACEBOOK_GRAPH_ROOT}/debug_token?input_token=${encodeURIComponent(pageToken)}`,
    pageToken,
  );
  const metadata = debug.json.data;
  const scopes = metadata?.scopes ?? [];
  const expiresAt = isoTimestamp(metadata?.expires_at);
  const dataAccessExpiresAt = isoTimestamp(metadata?.data_access_expires_at);
  const expiresSoon =
    Boolean(metadata?.expires_at) &&
    metadata!.expires_at! * 1000 < Date.now() + Number.parseInt(process.env.FACEBOOK_TOKEN_WARNING_DAYS || "21", 10) * 24 * 60 * 60 * 1000;
  const criticalTokenExpiration =
    Boolean(metadata?.expires_at) &&
    metadata!.expires_at! * 1000 < Date.now() + Number.parseInt(process.env.FACEBOOK_TOKEN_CRITICAL_DAYS || "7", 10) * 24 * 60 * 60 * 1000;
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

  const result = {
    healthy,
    configured: true,
    tokenStrategy: "page_token",
    credentialSource: source,
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
    criticalTokenExpiration,
    acceptableForLongRunningAutomation: healthy && !expiresSoon,
    postingScopePresent,
    scopes,
    actionRequired: !healthy
      ? "Replace the invalid Facebook Page access token."
      : expiresSoon
        ? `Replace or renew the Facebook Page access token before ${expiresAt}.`
        : undefined,
    error: debug.ok ? undefined : safeGraphError(debug.json),
  };
  await updateFacebookConnectionHealth({ status: healthy ? criticalTokenExpiration ? "CRITICAL" : expiresSoon ? "WARNING" : "HEALTHY" : "INVALID", expiresAt, dataAccessExpiresAt, error: result.error });
  return result;
}
