import type { ImportResult, NormalizedPublicRecord, OfficialRecordAdapter } from "./official-record-types";
import { validateNormalizedRecord } from "./official-record-types";

export const BSRDC_SOURCE_NAME = "BSRDC public roster";
export const BSRDC_SOURCE_URL = "https://bsrdc.com/";

export function parseBsrdcFixture(records: NormalizedPublicRecord[], fromDate: string, toDate: string): ImportResult {
  return {
    sourceName: BSRDC_SOURCE_NAME,
    fromDate,
    toDate,
    fetchedAt: new Date().toISOString(),
    records,
    warnings: records.flatMap(validateNormalizedRecord),
  };
}

export const bsrdcPublicRosterAdapter: OfficialRecordAdapter = {
  sourceName: BSRDC_SOURCE_NAME,
  sourceUrl: BSRDC_SOURCE_URL,
  enabled: process.env.BSRDC_IMPORT_ENABLED === "true",
  async fetchRange() {
    if (!this.enabled) throw new Error("BSRDC import is disabled. Set BSRDC_IMPORT_ENABLED=true only after source review.");
    throw new Error("Live BSRDC endpoint integration is not configured. Use reviewed fixture input only.");
  },
};
