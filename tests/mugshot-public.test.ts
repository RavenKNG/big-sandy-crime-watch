import { describe, expect, it } from "vitest";
import {
  MUGSHOT_FALLBACK_PATH,
  publicMugshotPath,
  publicMugshotUrl,
} from "../src/lib/mugshot-public";

describe("mugshot public URLs", () => {
  it("returns the branded fallback when no source image exists", () => {
    expect(publicMugshotPath()).toBe(MUGSHOT_FALLBACK_PATH);
    expect(publicMugshotUrl(undefined, "https://bigsandycrimewatch.com")).toBe(
      "https://bigsandycrimewatch.com/media/mugshot",
    );
  });

  it("proxies raw local image paths through the branded mugshot route", () => {
    expect(publicMugshotPath("/booking-images/example/mugshot.jpg")).toBe(
      "/media/mugshot?src=%2Fbooking-images%2Fexample%2Fmugshot.jpg",
    );
  });

  it("does not double-proxy an existing branded mugshot URL", () => {
    const existing = "https://bigsandycrimewatch.com/media/mugshot?src=%2Fbooking-images%2Fexample%2Fmugshot.jpg";
    expect(publicMugshotPath(existing)).toBe(
      "/media/mugshot?src=%2Fbooking-images%2Fexample%2Fmugshot.jpg",
    );
    expect(publicMugshotUrl(existing, "https://bigsandycrimewatch.com")).toBe(existing);
  });
});
