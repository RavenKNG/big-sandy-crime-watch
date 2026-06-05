import { describe, expect, it } from "vitest";
import {
  createFacebookFeedPostForm,
  createFacebookPhotoUploadForm,
  resolveFacebookPhotoUploadUrl,
} from "../src/lib/facebook-publish";

describe("facebook publish helpers", () => {
  it("creates unpublished photo uploads for feed-first posting", () => {
    const form = createFacebookPhotoUploadForm({
      imageUrl: "https://bigsandycrimewatch.com/booking-images/example/mugshot.jpg",
      accessToken: "token",
    });

    expect(form.get("url")).toBe("https://bigsandycrimewatch.com/booking-images/example/mugshot.jpg");
    expect(form.get("published")).toBe("false");
    expect(form.get("access_token")).toBe("token");
  });

  it("creates a feed post with attached media when a photo id is available", () => {
    const form = createFacebookFeedPostForm({
      message: "PUBLIC RECORD UPDATE",
      photoId: "12345",
      accessToken: "token",
      link: "https://bigsandycrimewatch.com/records/example",
    });

    expect(form.get("message")).toBe("PUBLIC RECORD UPDATE");
    expect(form.get("published")).toBe("true");
    expect(form.get("attached_media[0]")).toBe(JSON.stringify({ media_fbid: "12345" }));
    expect(form.get("link")).toBeNull();
  });

  it("falls back to a normal link post when there is no photo id", () => {
    const form = createFacebookFeedPostForm({
      message: "PUBLIC RECORD UPDATE",
      accessToken: "token",
      link: "https://bigsandycrimewatch.com/records/example",
    });

    expect(form.get("published")).toBe("true");
    expect(form.get("link")).toBe("https://bigsandycrimewatch.com/records/example");
    expect(form.get("attached_media[0]")).toBeNull();
  });

  it("resolves branded mugshot proxies back to real booking image urls", () => {
    const resolved = resolveFacebookPhotoUploadUrl(
      "/media/mugshot?src=%2Fbooking-images%2Fexample%2Fmugshot.jpg",
      "https://bigsandycrimewatch.com",
    );

    expect(resolved).toBe("https://bigsandycrimewatch.com/booking-images/example/mugshot.jpg");
  });
});
