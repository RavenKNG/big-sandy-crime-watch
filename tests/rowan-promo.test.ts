import { describe, expect, it } from "vitest";
import {
  ROWAN_PROMO_COOLDOWN_HOURS,
  createRowanPromoCaption,
  createRowanPromoCaptions,
  evaluateRowanPromoEligibility,
  rowanLandingUrl,
  rowanPromoDraftMeta,
} from "../src/lib/rowan-promo";

describe("Rowan promo", () => {
  it("creates rotating captions that point to the Rowan landing page", () => {
    const captions = createRowanPromoCaptions();
    expect(captions.length).toBeGreaterThanOrEqual(5);
    expect(captions[0]).toContain("Rowan County Detention Center inmates");
    expect(captions[0]).toContain(rowanLandingUrl());
    expect(createRowanPromoCaption(1)).not.toBe(createRowanPromoCaption(0));
  });

  it("blocks promo creation during the 72-hour cooldown", () => {
    const now = new Date("2026-06-04T12:00:00.000Z");
    const recentPost = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const result = evaluateRowanPromoEligibility({
      enabled: true,
      pageExists: true,
      facebookHealthy: true,
      postingEnabled: true,
      queuedExists: false,
      lastPostedAt: recentPost,
      now,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("72 hours");
    expect(result.nextEligibleAt?.toISOString()).toBe(
      new Date(recentPost.getTime() + ROWAN_PROMO_COOLDOWN_HOURS * 60 * 60 * 1000).toISOString(),
    );
  });

  it("prevents duplicate queued promos", () => {
    const result = evaluateRowanPromoEligibility({
      enabled: true,
      pageExists: true,
      facebookHealthy: true,
      postingEnabled: true,
      queuedExists: true,
      lastPostedAt: null,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("already queued");
  });

  it("does not create a promo when the Rowan page is missing", () => {
    const result = evaluateRowanPromoEligibility({
      enabled: true,
      pageExists: false,
      facebookHealthy: true,
      postingEnabled: true,
      queuedExists: false,
      lastPostedAt: null,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain("not available");
  });

  it("stores promo metadata as a draft-like queue item and does not imply immediate posting", () => {
    const meta = rowanPromoDraftMeta();
    expect(meta.type).toBe("ROWAN_LOOKUP_PROMO");
    expect(meta.pageTitle).toBe("Rowan County Detention Center Inmates");
    expect(meta.landingUrl).toBe(rowanLandingUrl());
    expect(meta.externalUrl).toContain("Rowan_County_KY");
  });
});
