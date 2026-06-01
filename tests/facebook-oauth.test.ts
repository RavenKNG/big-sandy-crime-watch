import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import { decryptFacebookToken, encryptFacebookToken, FACEBOOK_SCOPES, redactFacebookSecrets } from "../src/lib/facebook-connection";

const originalKey = process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("admin Facebook reconnect workflow", () => {
  it("encrypts stored Page tokens and decrypts them only with the server key", () => {
    process.env.FACEBOOK_TOKEN_ENCRYPTION_KEY = "synthetic-test-key";
    const encrypted = encryptFacebookToken("synthetic-page-token");
    expect(encrypted).not.toContain("synthetic-page-token");
    expect(decryptFacebookToken(encrypted)).toBe("synthetic-page-token");
  });

  it("redacts credential-like fields before errors reach logs or admin UI", () => {
    expect(redactFacebookSecrets({ access_token: "synthetic", nested: { appSecret: "hidden" } })).toEqual({
      access_token: "[redacted]",
      nested: { appSecret: "[redacted]" },
    });
  });

  it("requests only the reviewed Page-posting OAuth scopes", () => {
    expect(FACEBOOK_SCOPES).toEqual([
      "pages_show_list",
      "pages_read_engagement",
      "pages_manage_posts",
      "pages_manage_metadata",
      "public_profile",
    ]);
  });

  it("validates OAuth state before exchanging a callback code", async () => {
    const callback = await readFile("src/app/admin/facebook/callback/route.ts", "utf8");
    expect(callback).toContain('state !== expectedState');
    expect(callback).toContain("/me/accounts?fields=id,name,tasks,access_token");
    expect(callback).toContain("saveFacebookConnection");
  });

  it("keeps one-shot posting locked behind explicit configuration and confirmation", async () => {
    const testPost = await readFile("scripts/facebook-test-post.ts", "utf8");
    expect(testPost).toContain('process.env.FACEBOOK_TEST_POST_ENABLED !== "true"');
    expect(testPost).toContain('process.argv.includes("--confirm")');
  });
});
