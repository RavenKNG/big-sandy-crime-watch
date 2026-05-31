import { readFile } from "node:fs/promises";
import { bsrdcPublicRosterAdapter, parseBsrdcFixture } from "../src/lib/adapters/bsrdc-public-roster-adapter";
import { importNormalizedRecordsAsDrafts } from "../src/lib/adapters/bsrdc-import-to-drafts";
import type { NormalizedPublicRecord } from "../src/lib/adapters/official-record-types";

function getArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const fromDate = getArg("from");
  const toDate = getArg("to");
  const file = getArg("file");
  const dryRun = process.argv.includes("--dry-run");
  if (!fromDate || !toDate || !file) throw new Error("Usage: npm run import:bsrdc -- --from YYYY-MM-DD --to YYYY-MM-DD --file reviewed-fixture.json [--dry-run]");
  if (!bsrdcPublicRosterAdapter.enabled) throw new Error("BSRDC import is disabled. Set BSRDC_IMPORT_ENABLED=true only after source review.");
  const records = JSON.parse(await readFile(file, "utf8")) as NormalizedPublicRecord[];
  const result = parseBsrdcFixture(records, fromDate, toDate);
  console.log(JSON.stringify({ sourceName: result.sourceName, fromDate, toDate, recordCount: result.records.length, warningCount: result.warnings.length, warnings: result.warnings }, null, 2));
  if (dryRun) return;
  console.log(JSON.stringify(await importNormalizedRecordsAsDrafts(result.records), null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
