import { describe, expect, it, vi } from "vitest";
import reviewedFixture from "../fixtures/bsrdc-reviewed-sample.json";
import { bsrdcPublicRosterAdapter, parseBsrdcFixture } from "../src/lib/adapters/bsrdc-public-roster-adapter";
import { importNormalizedRecordAsDraft } from "../src/lib/adapters/bsrdc-import-to-drafts";
import { dedupeKey, normalizeNameParts, validateNormalizedRecord, type NormalizedPublicRecord } from "../src/lib/adapters/official-record-types";
import { createMappingReport, sanitizeMappingSample } from "../src/lib/adapters/bsrdc-mapping-report";
import sourceSnapshot from "../fixtures/bsrdc-source-snapshot-sanitized.json";
import { inferSnapshotRange, mapBsrdcSourceSnapshot } from "../src/lib/adapters/bsrdc-source-snapshot";

const fixture: NormalizedPublicRecord = {
  fullName: "Sample Public Fixture",
  intakeDate: "2026-05-31T10:00:00.000Z",
  sourceName: "Reviewed fixture",
  sourceUrl: "https://example.test/public-record/sample",
  sourceTimestamp: "2026-05-31T10:05:00.000Z",
  countyArrested: "Demo",
  charges: [{ offense: "Fixture charge", chargeDescription: "Synthetic listed charge", displayOrder: 0 }],
};

describe("BSRDC reviewed-fixture adapter", () => {
  it("is disabled by default", () => expect(bsrdcPublicRosterAdapter.enabled).toBe(false));
  it("normalizes name parts", () => expect(normalizeNameParts(" Sample Q Fixture ")).toEqual({ firstName: "Sample", middleName: "Q", lastName: "Fixture" }));
  it("creates stable dedupe keys", () => expect(dedupeKey(fixture)).toContain("sample public fixture"));
  it("collects fixture warnings without fetching a live source", () => expect(parseBsrdcFixture([fixture], "2026-05-01", "2026-05-31").warnings).toEqual([]));
  it("blocks address-like data", () => expect(validateNormalizedRecord({ ...fixture, complianceNotes: "Do not publish 123 Main Street" }).map((warning) => warning.code)).toContain("address_like_data"));
  it("imports reviewed records as drafts only", async () => {
    const create = vi.fn().mockResolvedValue({ id: "draft-1", slug: "sample-public-fixture-20260531" });
    const db = { publicRecordDemo: { findFirst: vi.fn().mockResolvedValue(null), create } };
    expect((await importNormalizedRecordAsDraft(fixture, db as never)).status).toBe("created_draft");
    expect(create.mock.calls[0][0].data.publishStatus).toBe("DRAFT");
  });
  it("skips duplicates", async () => {
    const db = { publicRecordDemo: { findFirst: vi.fn().mockResolvedValue({ id: "existing", slug: "sample" }), create: vi.fn() } };
    expect((await importNormalizedRecordAsDraft(fixture, db as never)).status).toBe("skipped_duplicate");
    expect(db.publicRecordDemo.create).not.toHaveBeenCalled();
  });
  it("maps the sanitized reviewed fixture with multiple charges", () => {
    const record = reviewedFixture[0] as NormalizedPublicRecord;
    expect(record.charges).toHaveLength(2);
    expect(record.permanentId).toBe("SYNTH-PERMANENT-001");
    expect(validateNormalizedRecord(record)).toEqual([]);
  });
  it("rejects missing source fields before persistence", async () => {
    const db = { publicRecordDemo: { findFirst: vi.fn(), create: vi.fn() } };
    expect((await importNormalizedRecordAsDraft({ ...fixture, sourceUrl: "" }, db as never)).status).toBe("skipped_warning");
    expect(db.publicRecordDemo.create).not.toHaveBeenCalled();
  });
  it("rejects address-like data before persistence", async () => {
    const db = { publicRecordDemo: { findFirst: vi.fn(), create: vi.fn() } };
    expect((await importNormalizedRecordAsDraft({ ...fixture, complianceNotes: "123 Main Street" }, db as never)).status).toBe("skipped_warning");
    expect(db.publicRecordDemo.create).not.toHaveBeenCalled();
  });
  it("does not publish or queue Facebook state", async () => {
    const create = vi.fn().mockResolvedValue({ id: "draft-1", slug: "sample-public-fixture-20260531" });
    const db = { publicRecordDemo: { findFirst: vi.fn().mockResolvedValue(null), create } };
    await importNormalizedRecordAsDraft(fixture, db as never);
    const data = create.mock.calls[0][0].data;
    expect(data.publishStatus).toBe("DRAFT");
    expect(data.facebookPostStatus).toBeUndefined();
    expect(data.facebookDrafts).toBeUndefined();
  });
  it("creates a dry-run-only mapping report without write flags", () => {
    const report = createMappingReport(reviewedFixture as NormalizedPublicRecord[], "2026-05-01", "2026-05-31");
    expect(report.mode).toBe("DRY_RUN_ONLY");
    expect(report.rowsFound).toBe(1);
    expect(report.chargeRows).toBe(2);
    expect(report.databaseWrites).toBe(false);
    expect(report.publicPublishing).toBe(false);
    expect(report.facebookQueueCreated).toBe(false);
  });
  it("redacts mapping sample identifiers and image references", () => {
    const sanitized = sanitizeMappingSample(reviewedFixture[0] as NormalizedPublicRecord);
    expect(sanitized.fullName).toBe("[REDACTED_NAME]");
    expect(sanitized.permanentId).toBe("[REDACTED_ID]");
    expect(sanitized.bookingImageUrl).toBe("[IMAGE_REFERENCE_PRESENT_NOT_STORED]");
    expect(sanitized.charges[0].caseNumber).toBe("[REDACTED_CASE_NUMBER]");
  });
  it("redacts address-like mapping sample text", () => {
    const sanitized = sanitizeMappingSample({ ...fixture, status: "123 Main Street" });
    expect(sanitized.status).toBe("[REDACTED_ADDRESS_LIKE_DATA]");
  });
  it("reports missing mapping fields", () => {
    const report = createMappingReport([fixture], "2026-05-01", "2026-05-31");
    expect(report.missingFields).toContain("bookingImageUrl");
  });
  it("maps a sanitized source-shaped local snapshot", () => {
    const [record] = mapBsrdcSourceSnapshot(sourceSnapshot);
    expect(record.fullName).toBe("Synthetic Snapshot Person");
    expect(record.age).toBe(41);
    expect(record.gender).toBe("Synthetic");
    expect(record.releaseDate).toBe("2026-05-31T09:00:00.000Z");
    expect(record.charges[0].statute).toBe("SNAPSHOT-1");
  });
  it("reports file snapshot range and missing fields clearly", () => {
    const records = mapBsrdcSourceSnapshot(sourceSnapshot);
    expect(inferSnapshotRange(records)).toEqual({ fromDate: "2026-05-30T09:00:00.000Z", toDate: "2026-05-30T09:00:00.000Z" });
    expect(createMappingReport(records, "from", "to").missingFields).toContain("bookingImageLocalPath");
  });
  it("redacts file snapshot identifiers without persistence state", () => {
    const [record] = mapBsrdcSourceSnapshot(sourceSnapshot);
    const sanitized = sanitizeMappingSample(record);
    expect(sanitized.fullName).toBe("[REDACTED_NAME]");
    expect(sanitized.offenderId).toBe("[REDACTED_ID]");
    expect(sanitized.arrestingOfficer).toBe("[REDACTED_OFFICER]");
    expect(sanitized.charges[0].controlNumber).toBe("[REDACTED_CONTROL_NUMBER]");
    expect(createMappingReport([record], "from", "to").databaseWrites).toBe(false);
  });
});
