import { describe, expect, it } from "vitest";
import { classifyFacebookDraftGap, type FacebookDraftGapRecord } from "../src/lib/facebook-draft-repair";

function record(overrides: Partial<FacebookDraftGapRecord> = {}): FacebookDraftGapRecord {
  return {
    id: "record-1",
    slug: "example-record",
    displayName: "Example Person",
    publishStatus: "PUBLISHED",
    facebookPostStatus: "NOT_QUEUED",
    createdAt: new Date("2026-06-06T12:00:00.000Z"),
    updatedAt: new Date("2026-06-06T12:00:00.000Z"),
    facebookDrafts: [],
    ...overrides,
  };
}

describe("Facebook draft repair classification", () => {
  it("marks published records with no draft as auto-repair eligible", () => {
    const result = classifyFacebookDraftGap(record());
    expect(result.needsRepair).toBe(true);
    expect(result.missingDraft).toBe(true);
    expect(result.autoCreateEligible).toBe(true);
    expect(result.reason).toBe("missing_facebook_draft");
  });

  it("does not repair a record with a valid posted draft", () => {
    const result = classifyFacebookDraftGap(
      record({
        facebookPostStatus: "POSTED",
        facebookDrafts: [
          {
            id: "draft-1",
            status: "POSTED",
            facebookPostId: "1179654975227785_122103487947349834",
          },
        ],
      }),
    );
    expect(result.needsRepair).toBe(false);
    expect(result.hasValidPostedDraft).toBe(true);
  });

  it("does not duplicate active queued drafts", () => {
    const result = classifyFacebookDraftGap(
      record({
        facebookPostStatus: "DRAFTED",
        facebookDrafts: [{ id: "draft-1", status: "DRAFTED", scheduledFor: new Date() }],
      }),
    );
    expect(result.needsRepair).toBe(false);
    expect(result.hasActiveDraft).toBe(true);
    expect(result.autoCreateEligible).toBe(false);
  });

  it("flags posted records that do not have a Facebook post ID", () => {
    const result = classifyFacebookDraftGap(
      record({
        facebookPostStatus: "POSTED",
        facebookDrafts: [{ id: "draft-1", status: "POSTED", facebookPostId: null }],
      }),
    );
    expect(result.needsRepair).toBe(true);
    expect(result.invalidPostedState).toBe(true);
    expect(result.autoCreateEligible).toBe(true);
    expect(result.reason).toBe("posted_without_valid_facebook_post_id");
  });

  it("warns about failed drafts without creating a retry loop", () => {
    const result = classifyFacebookDraftGap(
      record({
        facebookPostStatus: "FAILED",
        facebookDrafts: [{ id: "draft-1", status: "FAILED", errorMessage: "Graph error" }],
      }),
    );
    expect(result.needsRepair).toBe(true);
    expect(result.failedDraftCount).toBe(1);
    expect(result.autoCreateEligible).toBe(false);
    expect(result.reason).toBe("failed_draft_requires_review");
  });
});
