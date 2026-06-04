import { runOfficialSourceImport } from "../src/lib/official-source-import";

function readArg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const source = readArg("source");
  const fromDate = readArg("from");
  const toDate = readArg("to");
  const dryRun = process.argv.includes("--dry-run");
  const result = await runOfficialSourceImport({
    sourceSlugs: source ? [source] : undefined,
    fromDate,
    toDate,
    dryRun,
  });
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
