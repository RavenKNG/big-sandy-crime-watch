import { describe, expect, it } from "vitest";
import records from "../fixtures/demo-records.json";
import { categorize, dedupeKey, slugify } from "../src/lib/content";
import { createArticleDraft, createRecordDraft } from "../src/lib/facebook";
import { JsonFixtureImporter, parseCsv, validateDemoRecords } from "../src/lib/importers";
import { articles, demoRecords } from "../src/lib/demo-data";
import type { DemoRecord } from "../src/lib/types";

describe("demo CMS foundation", () => {
  it("creates clean slugs", () => expect(slugify(" Big Sandy: Public Safety! ")).toBe("big-sandy-public-safety"));
  it("deduplicates sanitized fixtures", async () => {
    const fixture = records[0] as DemoRecord;
    const imported = await new JsonFixtureImporter([fixture, fixture]).import();
    expect(imported).toHaveLength(1);
    expect(imported[0].publishStatus).toBe("DRAFT");
  });
  it("validates fixture JSON", () => expect(validateDemoRecords(records)).toHaveLength(1));
  it("parses CSV as draft records", () => expect(parseCsv("displayName,county,recordDate,status,sourceName,sourceTimestamp,offense,chargeDescription\nExample Person,Pike,2026-05-26T10:00:00.000Z,Synthetic,Fixture,2026-05-26T10:10:00.000Z,Demo,Synthetic charge")[0].publishStatus).toBe("DRAFT"));
  it("creates stable keys", () => expect(dedupeKey(demoRecords[0])).toContain("alex-rivera"));
  it("categorizes records", () => expect(categorize(demoRecords[0])).toContain("bookings"));
  it("generates editorial drafts", () => expect(createArticleDraft(articles[0])).toContain("/news/"));
  it("labels synthetic record drafts clearly", () => expect(createRecordDraft(demoRecords[0])).toContain("synthetic public-record demo"));
});
