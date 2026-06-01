import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";
import fixture from "../fixtures/official-source-roster-sanitized.json";
import {
  lastThreeEasternDays,
  parseOfficialRosterRows,
  runOfficialSourceImport,
  type VendorRosterRow,
} from "../src/lib/official-source-import";

describe("official BSRDC public roster parser", () => {
  afterEach(() => {
    delete process.env.OFFICIAL_SOURCE_FETCH_ENABLED;
    delete process.env.AUTO_IMPORT_OFFICIAL_RECORDS;
    delete process.env.AUTO_PUBLISH_VALID_IMPORTED_RECORDS;
  });

  it("maps allowlisted roster fields and a mugshot reference", () => {
    const [record] = parseOfficialRosterRows(fixture as VendorRosterRow[]);
    expect(record.sourceRecordId).toBe("SYNTH-OFFICIAL-001");
    expect(record.displayName).toBe("Reviewed Q Fixture");
    expect(record.age).toBe(31);
    expect(record.arrestingAgency).toBe("Fixture Agency");
    expect(record.arrestingOfficer).toBe("Officer Fixture");
    expect(record.county).toBe("Johnson");
    expect(record.imageId).toBe("fixture-mugshot.jpg");
    expect(record.charges[0].chargeDescription).toBe("Synthetic listed charge");
  });

  it("preserves original booking text and missing-time state", () => {
    const records = parseOfficialRosterRows(fixture as VendorRosterRow[]);
    expect(records[0].bookingDateTimeText).toBe("05/31/2026 08:45:00");
    expect(records[0].bookingTimeKnown).toBe(true);
    expect(records[1].bookingTimeKnown).toBe(false);
  });

  it("uses a transparent unavailable-charges placeholder", () => {
    const records = parseOfficialRosterRows(fixture as VendorRosterRow[]);
    expect(records[1].charges[0].chargeDescription).toBe(
      "Charges unavailable from source at time of import.",
    );
  });

  it("creates stable fingerprints and source slugs", () => {
    const first = parseOfficialRosterRows(fixture as VendorRosterRow[]);
    const second = parseOfficialRosterRows(fixture as VendorRosterRow[]);
    expect(first[0].sourceFingerprint).toBe(second[0].sourceFingerprint);
    expect(first[0].slug).toContain("synth-official-001");
  });

  it("calculates an inclusive three-Eastern-calendar-day range", () => {
    const range = lastThreeEasternDays();
    expect(Date.parse(range.toDate)).toBeGreaterThanOrEqual(Date.parse(range.fromDate));
    expect((Date.parse(range.toDate) - Date.parse(range.fromDate)) / 86_400_000).toBe(2);
  });

  it("does not expose non-allowlisted vendor fields", () => {
    const [record] = parseOfficialRosterRows([
      {
        ...(fixture[0] as VendorRosterRow),
        ssn: "000-00-0000",
        driversLicenseNumber: "SYNTHETIC-LICENSE",
      } as VendorRosterRow,
    ]);
    expect(record).not.toHaveProperty("ssn");
    expect(record).not.toHaveProperty("driversLicenseNumber");
  });

  it("stays disabled unless every automatic-import flag is explicitly enabled", async () => {
    expect(await runOfficialSourceImport()).toEqual({
      skipped: true,
      reason: "OFFICIAL_SOURCE_FETCH_ENABLED is not true.",
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

  it("posts a mugshot through the Facebook photo endpoint when one is ready", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain('${imageUrl ? "photos" : "feed"}');
    expect(runner).toContain("{ message: draft.postText, url: imageUrl, access_token: pageToken }");
  });

  it("keeps expired-token Facebook drafts retryable for the next interval", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("graphError.error?.code === 190");
    expect(runner).toContain('status: retryableCredentialError ? "DRAFTED" : "FAILED"');
    expect(runner).toContain('envNum("POST_INTERVAL_HOURS", 3) * 60 * 60 * 1000');
  });

  it("checks Facebook Page-token health before posting each worker cycle", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("verifyFacebookPageToken()");
    expect(runner).toContain("Facebook Page token health check failed; queue preserved.");
  });

  it("supports page-token and Business system-user credential strategies", async () => {
    const health = await readFile("src/lib/facebook-token-health.ts", "utf8");
    expect(health).toContain('process.env.FACEBOOK_TOKEN_STRATEGY || "page_token"');
    expect(health).toContain("process.env.FACEBOOK_SYSTEM_USER_ACCESS_TOKEN");
    expect(health).toContain("acceptableForLongRunningAutomation");
    expect(health).toContain("criticalTokenExpiration");
  });
});
