import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import records from "../fixtures/demo-records.json";
import { JsonFixtureImporter, parseCsv, validateDemoRecords } from "../src/lib/importers";

async function main() {
  const fileIndex = process.argv.indexOf("--file");
  const file = fileIndex >= 0 ? process.argv[fileIndex + 1] : undefined;
  const raw = file ? await readFile(file, "utf8") : undefined;
  const input = file && raw
    ? extname(file).toLowerCase() === ".csv" ? parseCsv(raw) : validateDemoRecords(JSON.parse(raw))
    : validateDemoRecords(records);
  const imported = await new JsonFixtureImporter(input).import();
  console.log(JSON.stringify({
    mode: process.argv.slice(2),
    source: file ?? "synthetic-json-fixture",
    recordsCreated: imported.length,
    recordsSkipped: input.length - imported.length,
    publishStatus: imported[0]?.publishStatus,
  }, null, 2));
}

void main();
