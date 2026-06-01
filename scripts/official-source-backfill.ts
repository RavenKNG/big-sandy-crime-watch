import { runOfficialSourceImport } from "../src/lib/official-source-import";

async function main() {
  const result = await runOfficialSourceImport();
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
