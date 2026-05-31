import { z } from "zod";
import { dedupeKey, slugify } from "./content";
import type { DemoRecord } from "./types";

export interface DemoImporter {
  name: string;
  import(): Promise<DemoRecord[]>;
}

export function normalizeDraft(record: DemoRecord): DemoRecord {
  return { ...record, slug: record.slug || `${slugify(record.displayName)}-${record.recordDate.slice(0, 10)}`, publishStatus: "DRAFT" };
}

export function dedupe(records: DemoRecord[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = dedupeKey(record);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export class JsonFixtureImporter implements DemoImporter {
  name = "synthetic-json-fixture";
  constructor(private records: DemoRecord[]) {}
  async import() {
    return dedupe(this.records.map(normalizeDraft));
  }
}

const chargeSchema = z.object({
  offense: z.string().min(1),
  statute: z.string().optional(),
  chargeDescription: z.string().min(1),
  caseNumber: z.string().optional(),
});

const recordSchema = z.object({
  slug: z.string().default(""),
  displayName: z.string().min(1),
  age: z.number().int().positive().optional(),
  gender: z.string().optional(),
  county: z.string().min(1),
  recordDate: z.string().datetime(),
  status: z.string().min(1),
  sourceName: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  sourceTimestamp: z.string().datetime(),
  imageUrl: z.string().optional(),
  publishStatus: z.enum(["DRAFT", "APPROVED", "PUBLISHED", "HIDDEN", "REJECTED"]).default("DRAFT"),
  charges: z.array(chargeSchema).min(1),
});

export function validateDemoRecords(records: unknown) {
  return z.array(recordSchema).parse(records) as DemoRecord[];
}

export function parseCsv(text: string): DemoRecord[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((value) => value.trim());
  return lines.slice(1).filter(Boolean).map((line) => {
    const cells = line.split(",").map((value) => value.trim());
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""]));
    return recordSchema.parse({
      slug: row.slug,
      displayName: row.displayName,
      county: row.county,
      recordDate: row.recordDate,
      status: row.status,
      sourceName: row.sourceName,
      sourceTimestamp: row.sourceTimestamp,
      publishStatus: "DRAFT",
      charges: [{ offense: row.offense, statute: row.statute || undefined, chargeDescription: row.chargeDescription }],
    });
  });
}

export const officialSourceAdapterStatus = {
  enabled: false,
  message: "Disabled pending human legal and platform review. Implement as a separate adapter without changing the fixture importer contract.",
};
