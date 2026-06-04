import { queueRowanPromoDraft } from "../src/lib/rowan-promo-runtime";

async function main() {
  const result = await queueRowanPromoDraft({ force: true });
  console.log(JSON.stringify(result, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
