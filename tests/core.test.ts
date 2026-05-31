import { describe, expect, it } from "vitest";
import records from "../fixtures/demo-records.json";
import { categorize, dedupeKey, slugify } from "../src/lib/content";
import { createArticleDraft, createRecordDraft, recordTemplates } from "../src/lib/facebook";
import { JsonFixtureImporter, parseCsv, validateDemoRecords } from "../src/lib/importers";
import { articles, demoRecords } from "../src/lib/demo-data";
import type { DemoRecord } from "../src/lib/types";
import { correctionFormSchema, parseChargeLines, recordFormSchema } from "../src/lib/forms";

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
  it("provides rotating careful record templates",()=>expect(recordTemplates).toHaveLength(10));
  it("parses multiple manual charges",()=>expect(parseChargeLines("One | A | First\nTwo | B | Second")).toHaveLength(2));
  it("validates manual synthetic records",()=>expect(recordFormSchema.parse({displayName:"Demo Name",county:"Pike",recordDate:"2026-05-31",sourceName:"Synthetic fixture",sourceUrl:"",sourceTimestamp:"2026-05-31",imageUrl:"",complianceNotes:"Reviewed demo",charges:"Demo"}).displayName).toBe("Demo Name"));
  it("validates correction submissions",()=>expect(correctionFormSchema.parse({name:"Jane Doe",email:"jane@example.test",requestType:"CORRECTION",relatedUrl:"",message:"Please review this demo entry."}).requestType).toBe("CORRECTION"));
});
