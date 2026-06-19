import fs from "node:fs/promises";
import path from "node:path";
import { buildBookingCatchUpReels, getBookingCatchUpConfig } from "../src/lib/booking-catchup";

const previewSlots = ["06:00", "19:00"];

function readArg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main() {
  const dayKey = readArg("--day");
  const config = {
    ...getBookingCatchUpConfig(),
    enabled: true,
    autoPost: false,
    times: previewSlots,
    maxRecords: 10,
    maxRecordsPerReel: 8,
    maxReelsPerDay: 1,
    targetDurationSeconds: 20,
    minDurationSeconds: 20,
    audioFadeSeconds: 0,
  };

  const generated = [];
  for (const slotTime of previewSlots) {
    const result = await buildBookingCatchUpReels({ dayKey, slotTime, config });
    generated.push(result);
  }

  const outputRoot = path.resolve("reports", "booking-catchup-preview");
  await fs.mkdir(outputRoot, { recursive: true });
  const manifestPath = path.join(outputRoot, "latest-preview-manifest.json");
  await fs.writeFile(manifestPath, JSON.stringify({ generatedAt: new Date().toISOString(), generated }, null, 2), "utf8");
  console.log(JSON.stringify({ manifestPath, generated }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
