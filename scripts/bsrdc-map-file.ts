import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createMappingReport, sanitizeMappingSample } from "../src/lib/adapters/bsrdc-mapping-report";
import { inferSnapshotRange, mapBsrdcSourceSnapshot } from "../src/lib/adapters/bsrdc-source-snapshot";

function getArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function main() {
  const file = getArg("file");
  if (!file) throw new Error("Usage: npm run bsrdc:map-file -- --file path-to-human-reviewed-local-snapshot.json");
  const records = mapBsrdcSourceSnapshot(JSON.parse(await readFile(file, "utf8")));
  const { fromDate, toDate } = inferSnapshotRange(records);
  const report = createMappingReport(records, fromDate, toDate);
  await mkdir("work", { recursive: true });
  await writeFile("work/bsrdc-file-mapping-report.json", JSON.stringify(report, null, 2));
  await writeFile("work/bsrdc-file-sanitized-sample.json", JSON.stringify(records.map(sanitizeMappingSample), null, 2));
  console.log(JSON.stringify(report, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
