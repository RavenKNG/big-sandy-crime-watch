import { describe, expect, it, vi } from "vitest";
import reviewedFixture from "../fixtures/bsrdc-reviewed-sample.json";
import { bsrdcPublicRosterAdapter, parseBsrdcFixture } from "../src/lib/adapters/bsrdc-public-roster-adapter";
import { importNormalizedRecordAsDraft } from "../src/lib/adapters/bsrdc-import-to-drafts";
import { dedupeKey, normalizeNameParts, validateNormalizedRecord, type NormalizedPublicRecord } from "../src/lib/adapters/official-record-types";

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
});
