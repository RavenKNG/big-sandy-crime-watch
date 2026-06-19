import fs from "node:fs/promises";
import path from "node:path";
import type { BookingCardRecord } from "../src/lib/booking-card-generator";
import { generateBookingCardImages } from "../src/lib/booking-card-generator";
import { absoluteSiteUrl } from "../src/lib/display-format";
import { bookingImageAbsolutePathFromPublicPath } from "../src/lib/booking-image-storage";

const defaultOutputRoot = path.resolve("reports/booking-catchup-review/latest/booking-card-samples");
process.env.BOOKING_IMAGE_STORAGE_DIR = process.env.BOOKING_IMAGE_STORAGE_DIR || defaultOutputRoot;

function loadReviewSamples(): Array<BookingCardRecord & { sampleLabel: string }> {
  return [
    {
      sampleLabel: "normal-name",
      slug: "sample-normal-name",
      displayName: "James E Ward",
      age: 41,
      bookingDateTimeText: "06/16/2026 00:00:00",
      bookingTimeKnown: false,
      arrestingAgency: "K.S.P",
      sourceName: "Big Sandy Regional Detention Center Public Roster",
    },
    {
      sampleLabel: "long-name",
      slug: "sample-long-name",
      displayName: "Christopher Alexander Montgomery",
      age: null,
      bookingDateTimeText: "06/16/2026 00:00:00",
      bookingTimeKnown: false,
      arrestingAgency: "Martin SO",
      sourceName: "Big Sandy Regional Detention Center Public Roster",
    },
    {
      sampleLabel: "long-agency",
      slug: "sample-long-agency",
      displayName: "Austin Oneil Harless",
      age: 28,
      bookingDateTimeText: "06/16/2026 00:00:00",
      bookingTimeKnown: false,
      arrestingAgency: "Big Sandy Regional Detention Center Transport Division",
      sourceName: "Big Sandy Regional Detention Center Public Roster",
    },
    {
      sampleLabel: "missing-agency-fallback",
      slug: "sample-missing-agency",
      displayName: "Jennifer Lee Workman",
      age: null,
      bookingDateTimeText: "06/16/2026 00:00:00",
      bookingTimeKnown: false,
      arrestingAgency: null,
      sourceName: null,
    },
    {
      sampleLabel: "missing-booked-fallback",
      slug: "sample-missing-booked",
      displayName: "Timothy A Mullett",
      age: 35,
      bookingDateTimeText: null,
      bookingTimeKnown: false,
      recordDate: null,
      arrestingAgency: "MCSD",
      sourceName: "Big Sandy Regional Detention Center Public Roster",
    },
  ];
}

async function main() {
  const samples = loadReviewSamples();

  const output = [];
  for (const sample of samples) {
    const cards = await generateBookingCardImages(sample);

    output.push({
      sampleLabel: sample.sampleLabel,
      slug: sample.slug,
      source: "booking_catchup_booking_card_review_sample",
      previewPath: cards.previewPath,
      previewFile: bookingImageAbsolutePathFromPublicPath(cards.previewPath),
      previewUrl: absoluteSiteUrl(cards.previewPath),
      fullPath: cards.fullPath,
      fullFile: bookingImageAbsolutePathFromPublicPath(cards.fullPath),
      fullUrl: absoluteSiteUrl(cards.fullPath),
    });
  }

  const manifestPath = path.resolve("reports/booking-catchup-review/latest/review-manifest.json");
  const manifestText = await fs.readFile(manifestPath, "utf8").catch(() => null);
  if (manifestText) {
    const manifest = JSON.parse(manifestText) as Record<string, unknown>;
    manifest.bookingCardSamples = output;
    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(JSON.stringify({ ok: true, manifestPath: manifestText ? manifestPath : null, samples: output }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
