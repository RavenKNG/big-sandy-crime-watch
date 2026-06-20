import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/official-source-roster-sanitized.json";
import {
  lastThreeEasternDays,
  parseOfficialRosterRows,
  runOfficialSourceImport,
  type VendorRosterRow,
} from "../src/lib/official-source-import";
import { findOfficialSourceBySlug, officialSourceApiHeaders } from "../src/lib/official-sources";

describe("official BSRDC public roster parser", () => {
  afterEach(() => {
    delete process.env.OFFICIAL_SOURCE_FETCH_ENABLED;
    delete process.env.OFFICIAL_SOURCE_API_KEY;
    delete process.env.AUTO_IMPORT_OFFICIAL_RECORDS;
    delete process.env.AUTO_PUBLISH_VALID_IMPORTED_RECORDS;
  });

  it("maps allowlisted roster fields and a mugshot reference", () => {
    const source = findOfficialSourceBySlug("big-sandy-regional-detention-center")!;
    const [record] = parseOfficialRosterRows(fixture as VendorRosterRow[], source);
    expect(record.sourceRecordId).toBe(
      "big-sandy-regional-detention-center:SYNTH-OFFICIAL-001",
    );
    expect(record.displayName).toBe("Reviewed Q Fixture");
    expect(record.age).toBe(31);
    expect(record.arrestingAgency).toBe("Fixture Agency");
    expect(record.arrestingOfficer).toBe("Officer Fixture");
    expect(record.county).toBe("Johnson");
    expect(record.imageId).toBe("fixture-mugshot.jpg");
    expect(record.charges[0].chargeDescription).toBe("Synthetic listed charge");
  });

  it("preserves original booking text and missing-time state", () => {
    const source = findOfficialSourceBySlug("big-sandy-regional-detention-center")!;
    const records = parseOfficialRosterRows(fixture as VendorRosterRow[], source);
    expect(records[0].bookingDateTimeText).toBe("05/31/2026 08:45:00");
    expect(records[0].bookingTimeKnown).toBe(true);
    expect(records[1].bookingTimeKnown).toBe(false);
  });

  it("uses a transparent unavailable-charges placeholder", () => {
    const source = findOfficialSourceBySlug("big-sandy-regional-detention-center")!;
    const records = parseOfficialRosterRows(fixture as VendorRosterRow[], source);
    expect(records[1].charges[0].chargeDescription).toBe(
      "Charges unavailable from source at time of import.",
    );
  });

  it("creates stable fingerprints and source slugs", () => {
    const source = findOfficialSourceBySlug("big-sandy-regional-detention-center")!;
    const first = parseOfficialRosterRows(fixture as VendorRosterRow[], source);
    const second = parseOfficialRosterRows(fixture as VendorRosterRow[], source);
    expect(first[0].sourceFingerprint).toBe(second[0].sourceFingerprint);
    expect(first[0].slug).toContain("big-sandy-regional-detention-center");
  });

  it("calculates an inclusive three-Eastern-calendar-day range", () => {
    const range = lastThreeEasternDays();
    expect(Date.parse(range.toDate)).toBeGreaterThanOrEqual(Date.parse(range.fromDate));
    expect((Date.parse(range.toDate) - Date.parse(range.fromDate)) / 86_400_000).toBe(2);
  });

  it("does not expose non-allowlisted vendor fields", () => {
    const source = findOfficialSourceBySlug("big-sandy-regional-detention-center")!;
    const [record] = parseOfficialRosterRows([
      {
        ...(fixture[0] as VendorRosterRow),
        ssn: "000-00-0000",
        driversLicenseNumber: "SYNTHETIC-LICENSE",
      } as VendorRosterRow,
    ], source);
    expect(record).not.toHaveProperty("ssn");
    expect(record).not.toHaveProperty("driversLicenseNumber");
  });

  it("falls back to the facility county when no associated county is provided", () => {
    const source = findOfficialSourceBySlug("rowan-county-detention-center")!;
    const [record] = parseOfficialRosterRows([
      {
        id: "ROWAN-1",
        agencyOffenderPermanentId: "ROWAN-1",
        firstName: "Rowan",
        lastName: "Example",
        gender: "M",
        supervisionStatus: "Current",
        bookDate: "06/03/2026 10:30:00",
        detailsJson: JSON.stringify([
          {
            filename: "AdditionalInfo",
            type: "nvp",
            data: [{ Name: "Arresting Agency", Value: "Morehead Police Department" }],
          },
        ]),
      },
    ], source);
    expect(record.county).toBe("Rowan");
    expect(record.sourceRecordId).toBe("rowan-county-detention-center:ROWAN-1");
  });

  it("stays disabled unless every automatic-import flag is explicitly enabled", async () => {
    expect(await runOfficialSourceImport()).toEqual({
      skipped: true,
      reason: "OFFICIAL_SOURCE_FETCH_ENABLED is not true.",
    });
  });

  it("sends the vendor API key header when configured", () => {
    process.env.OFFICIAL_SOURCE_API_KEY = "test-key";
    expect(officialSourceApiHeaders()).toEqual({
      "Content-Type": "application/json",
      "X-API-KEY": "test-key",
    });
  });

  it("omits the vendor API key header when not configured", () => {
    expect(officialSourceApiHeaders()).toEqual({
      "Content-Type": "application/json",
    });
  });

  it("runs official import before Facebook posting in the worker cycle", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    const runOnce = runner.slice(runner.indexOf("async function runOnce("));
    expect(runOnce.indexOf("runOfficialSourceImport()")).toBeLessThan(
      runOnce.indexOf("postNextFacebookDraft()"),
    );
  });

  it("supports skipping only the startup Facebook post after a worker restart", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain('envBool("AUTOMATION_SKIP_INITIAL_FACEBOOK_POST", false)');
    expect(runner).toContain("setInterval(() => {\n    runOnce().catch");
  });

  it("recreates the PM2 automation process from the tracked ecosystem file during deploy", async () => {
    const deploy = await readFile("scripts/deploy-production.ps1", "utf8");
    expect(deploy).toContain("pm2 delete big-sandy-crime-watch-automation");
    expect(deploy).toContain("pm2 start ecosystem.config.cjs --only big-sandy-crime-watch-automation");
    expect(deploy).toContain('grep -q "node_modules/tsx/dist/cli.mjs"');
  });

  it("publishes raster mugshots as feed posts with attached media when an image is ready", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    const publishHelpers = await readFile("src/lib/facebook-publish.ts", "utf8");
    expect(runner).toContain("resolveFacebookPhotoUploadUrl");
    expect(runner).toContain('https://graph.facebook.com/v25.0/${pageId}/photos');
    expect(runner).toContain("createFacebookPhotoUploadForm");
    expect(runner).toContain('https://graph.facebook.com/v25.0/${pageId}/feed');
    expect(runner).toContain("createFacebookFeedPostForm");
    expect(publishHelpers).toContain("published: false");
    expect(publishHelpers).toContain("published: true");
    expect(publishHelpers).toContain('attached_media[0]');
    expect(publishHelpers).not.toContain("no_story");
    expect(publishHelpers).not.toContain("unpublished_content_type");
    expect(publishHelpers).not.toContain("scheduled_publish_time");
    expect(publishHelpers).not.toContain("targeting");
  });

  it("blocks link-only fallback for booking posts when Facebook rejects a mugshot upload", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("graphError.error?.error_subcode === 1366046");
    expect(runner).toContain("graphError.error?.error_subcode === 2069019");
    expect(runner).toContain("link-only fallback blocked");
    expect(runner).toContain("failedImageRead && !draft.recordId");
  });

  it("keeps expired-token Facebook drafts retryable for the next interval", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("isRetryableFacebookGraphError");
    expect(runner).toContain("[1, 2, 4, 17, 32, 190, 613]");
    expect(runner).toContain('status: retryableFacebookError ? "DRAFTED" : "FAILED"');
    expect(runner).toContain('envNum("POST_INTERVAL_HOURS", 3) * 60 * 60 * 1000');
  });

  it("checks Facebook Page-token health before posting each worker cycle", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("verifyFacebookPageToken()");
    expect(runner).toContain("Facebook Page token health check failed; queue preserved.");
  });

  it("monitors Page-token health without requiring a Business system-user strategy", async () => {
    const health = await readFile("src/lib/facebook-token-health.ts", "utf8");
    expect(health).toContain("getFacebookCredential()");
    expect(health).toContain("acceptableForLongRunningAutomation");
    expect(health).toContain("criticalTokenExpiration");
    expect(health).toContain("is_live");
    expect(health).toContain("publicVisibilityRisk");
  });

  it("queues tagged public record URLs for future Facebook posts", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    const source = await readFile("src/lib/official-source-import.ts", "utf8");
    const draftHelper = await readFile("src/lib/facebook-record-drafts.ts", "utf8");
    expect(runner).toContain("repairMissingFacebookDrafts");
    expect(source).toContain("createFacebookRecordDraftPayload");
    expect(draftHelper).toContain("facebookRecordUrl(record.slug, siteUrl)");
    expect(source).toContain('data: { facebookPostStatus: draftStatus }');
  });

  it("repairs manual booking Facebook drafts when a mugshot appears later", async () => {
    const source = await readFile("src/lib/official-source-import.ts", "utf8");
    expect(source).toContain('existing.status !== "POSTED" && draftPayload.imageUrl');
    expect(source).toContain('status: "DRAFTED"');
    expect(source).toContain("errorMessage: null");
    expect(source).toContain("repairedDrafts.count > 0");
    expect(source).toContain("absoluteSiteUrl(imagePath)");
  });

  it("self-heals missing Facebook drafts before posting", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    const runOnce = runner.slice(runner.indexOf("async function runOnce("));
    expect(runOnce.indexOf("createFacebookDraftsForPublishedRecords()")).toBeLessThan(
      runOnce.indexOf("verifyFacebookPageToken()"),
    );
    expect(runner).toContain('envNum("FACEBOOK_DRAFT_REPAIR_WINDOW_HOURS", 72)');
    expect(runner).toContain('envNum("FACEBOOK_DRAFT_REPAIR_MAX_CREATE", 25)');
  });

  it("runs the Booking Catch-Up automation from the worker cycle", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    const runOnce = runner.slice(runner.indexOf("async function runOnce("));
    expect(runner).toContain("runBookingCatchUpAutomation");
    expect(runner).toContain("publishBookingCatchUpFacebookReel");
    expect(runOnce).toContain("bookingCatchUpResult");
    expect(runOnce.indexOf("verifyFacebookPageToken()")).toBeLessThan(
      runOnce.indexOf("runBookingCatchUpAutomation"),
    );
  });
});
