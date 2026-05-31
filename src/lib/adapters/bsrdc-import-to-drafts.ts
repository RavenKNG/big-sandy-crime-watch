import { getDb } from "../db";
import { chargeHash, dedupeKey, validateNormalizedRecord, type NormalizedPublicRecord } from "./official-record-types";

type DraftDb = ReturnType<typeof getDb>;
const blockingWarnings = new Set(["missing_name", "missing_source", "missing_charges", "address_like_data"]);
const slugify = (input: string) => input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 90);
const createSlug = (record: NormalizedPublicRecord) => slugify(`${record.fullName}-${record.intakeDate?.replace(/[^0-9]/g, "").slice(0, 8) || Date.now()}`);

export async function importNormalizedRecordAsDraft(record: NormalizedPublicRecord, db: DraftDb = getDb()) {
  const warnings = validateNormalizedRecord(record);
  if (warnings.some((warning) => blockingWarnings.has(warning.code))) return { status: "skipped_warning" as const, warnings };
  const slug = createSlug(record);
  const existing = await db.publicRecordDemo.findFirst({ where: { OR: [{ slug }, { sourceUrl: record.sourceUrl }] } });
  if (existing) return { status: "skipped_duplicate" as const, id: existing.id, slug: existing.slug, warnings };
  const created = await db.publicRecordDemo.create({ data: {
    slug, displayName: record.fullName, age: record.age, gender: record.gender, county: record.countyArrested,
    recordDate: record.intakeDate ? new Date(record.intakeDate) : new Date(), status: record.status,
    sourceName: record.sourceName, sourceUrl: record.sourceUrl, sourceTimestamp: new Date(record.sourceTimestamp),
    imageUrl: record.bookingImageUrl, imageLocalPath: record.bookingImageLocalPath, publishStatus: "DRAFT",
    complianceNotes: [record.complianceNotes, `duplicateKey: ${dedupeKey(record)}`, `chargeHash: ${chargeHash(record.charges)}`].filter(Boolean).join("\n\n"),
    charges: { create: record.charges.map((charge) => ({ offense: charge.offense || charge.chargeDescription, statute: charge.statute, chargeDescription: charge.chargeDescription, caseNumber: charge.caseNumber, displayOrder: charge.displayOrder })) },
  } });
  return { status: "created_draft" as const, id: created.id, slug: created.slug, warnings };
}

export async function importNormalizedRecordsAsDrafts(records: NormalizedPublicRecord[], db: DraftDb = getDb()) {
  const results = [];
  for (const record of records) results.push(await importNormalizedRecordAsDraft(record, db));
  return {
    created: results.filter((result) => result.status === "created_draft").length,
    skipped: results.filter((result) => result.status !== "created_draft").length,
    results,
  };
}
