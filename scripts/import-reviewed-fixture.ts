import { readFile } from "node:fs/promises";
import { parseBsrdcFixture } from "../src/lib/adapters/bsrdc-public-roster-adapter";
import { importNormalizedRecordsAsDrafts } from "../src/lib/adapters/bsrdc-import-to-drafts";
import { chargeHash, dedupeKey, type NormalizedPublicRecord } from "../src/lib/adapters/official-record-types";

async function main() {
  const records = JSON.parse(await readFile("fixtures/bsrdc-reviewed-sample.json", "utf8")) as NormalizedPublicRecord[];
  const result = parseBsrdcFixture(records, "synthetic-fixture", "synthetic-fixture");
  const imported = await importNormalizedRecordsAsDrafts(result.records);
  console.log(JSON.stringify({
    mode: "reviewed-synthetic-fixture",
    fetched: result.records.length,
    warnings: result.warnings.length,
    createdDrafts: imported.created,
    skipped: imported.skipped,
    records: result.records.map((record, index) => ({
      fullName: record.fullName,
      dedupeKey: dedupeKey(record),
      chargeHash: chargeHash(record.charges),
      status: imported.results[index]?.status,
      slug: "slug" in (imported.results[index] || {}) ? imported.results[index].slug : undefined,
    })),
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
