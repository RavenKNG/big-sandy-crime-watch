import crypto from "node:crypto";
import { getDb } from "./db";

export const FACEBOOK_CONNECTION_ID = "primary";
export const FACEBOOK_GRAPH_ROOT = "https://graph.facebook.com/v25.0";
export const FACEBOOK_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "public_profile",
] as const;

export function redactFacebookSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactFacebookSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, nested]) => [
      key,
      /token|secret|authorization/i.test(key) ? "[redacted]" : redactFacebookSecrets(nested),
    ]));
  }
  if (typeof value === "string") return value.replace(/EAA[A-Za-z0-9]+/g, "[redacted]");
  return value;
}

function encryptionKey() {
  const configured = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;
  if (!configured) throw new Error("FACEBOOK_TOKEN_ENCRYPTION_KEY is not configured.");
  return crypto.createHash("sha256").update(configured).digest();
}

export function encryptFacebookToken(token: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

export function decryptFacebookToken(payload: string) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64url"));
  if (!iv || !tag || !encrypted) throw new Error("Stored Facebook token payload is invalid.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, "utf8") + decipher.final("utf8");
}

export async function getFacebookCredential() {
  try {
    const stored = await getDb().facebookConnection.findUnique({ where: { id: FACEBOOK_CONNECTION_ID } });
    if (stored) return { pageId: stored.pageId, pageToken: decryptFacebookToken(stored.encryptedPageToken), source: "stored_oauth" as const, connection: stored };
  } catch {
    // Environment fallback allows a controlled migration before the new table is deployed.
  }
  const pageId = process.env.FACEBOOK_PAGE_ID;
  const pageToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  return pageId && pageToken ? { pageId, pageToken, source: "environment" as const } : undefined;
}

export async function saveFacebookConnection(input: { pageId: string; pageName: string; pageToken: string }) {
  return getDb().facebookConnection.upsert({
    where: { id: FACEBOOK_CONNECTION_ID },
    create: { id: FACEBOOK_CONNECTION_ID, pageId: input.pageId, pageName: input.pageName, encryptedPageToken: encryptFacebookToken(input.pageToken) },
    update: { pageId: input.pageId, pageName: input.pageName, encryptedPageToken: encryptFacebookToken(input.pageToken), tokenStatus: "CONNECTED", lastFacebookError: null },
  });
}

export async function updateFacebookConnectionHealth(input: { status: string; expiresAt?: string; dataAccessExpiresAt?: string; error?: unknown }) {
  try {
    await getDb().facebookConnection.update({
      where: { id: FACEBOOK_CONNECTION_ID },
      data: {
        tokenStatus: input.status,
        tokenExpiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        dataAccessExpiresAt: input.dataAccessExpiresAt ? new Date(input.dataAccessExpiresAt) : null,
        lastHealthCheckAt: new Date(),
        lastFacebookError: input.error ? JSON.stringify(redactFacebookSecrets(input.error)) : null,
      },
    });
  } catch {
    // Health checks remain usable during initial migration and environment fallback.
  }
}

export async function markFacebookPostResult(error?: unknown) {
  try {
    await getDb().facebookConnection.update({
      where: { id: FACEBOOK_CONNECTION_ID },
      data: error ? { lastFacebookError: JSON.stringify(redactFacebookSecrets(error)) } : { lastSuccessfulPostAt: new Date(), lastFacebookError: null },
    });
  } catch {
    // Environment fallback may not have a stored connection yet.
  }
}
