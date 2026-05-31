import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createMappingReport, sanitizeMappingSample } from "../src/lib/adapters/bsrdc-mapping-report";
import type { NormalizedPublicRecord } from "../src/lib/adapters/official-record-types";

function getArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const fromDate = getArg("from");
  const toDate = getArg("to");
  const file = getArg("file") || "fixtures/bsrdc-reviewed-sample.json";
  if (!fromDate || !toDate) throw new Error("Usage: npm run bsrdc:map-dry-run -- --from YYYY-MM-DD --to YYYY-MM-DD [--file reviewed-snapshot.json]");
  const records = JSON.parse(await readFile(file, "utf8")) as NormalizedPublicRecord[];
  const report = createMappingReport(records, fromDate, toDate);
  const sample = records.map(sanitizeMappingSample);
  await mkdir("work", { recursive: true });
  await writeFile("work/bsrdc-mapping-report.json", JSON.stringify(report, null, 2));
  await writeFile("work/bsrdc-sanitized-sample.json", JSON.stringify(sample, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
