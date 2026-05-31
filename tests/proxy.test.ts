import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

const originalEmail = process.env.ADMIN_EMAIL;
const originalPassword = process.env.ADMIN_PASSWORD;

afterEach(() => {
  process.env.ADMIN_EMAIL = originalEmail;
  process.env.ADMIN_PASSWORD = originalPassword;
});

describe("admin proxy", () => {
  it("returns 503 until admin credentials are configured", () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    expect(proxy(new NextRequest("http://localhost/admin")).status).toBe(503);
  });

  it("challenges unauthenticated admin requests", () => {
    process.env.ADMIN_EMAIL = "admin@example.test";
    process.env.ADMIN_PASSWORD = "test-password";
    expect(proxy(new NextRequest("http://localhost/admin")).status).toBe(401);
  });

  it("accepts matching Basic Auth credentials", () => {
    process.env.ADMIN_EMAIL = "admin@example.test";
    process.env.ADMIN_PASSWORD = "test-password";
    const authorization = `Basic ${Buffer.from("admin@example.test:test-password").toString("base64")}`;
    expect(proxy(new NextRequest("http://localhost/admin", { headers: { authorization } })).status).toBe(200);
  });
});
