import type { BookingCardRecord } from "../src/lib/booking-card-generator";
import { generateBookingCardImages } from "../src/lib/booking-card-generator";
import { getPublishedRecords } from "../src/lib/content";
import { absoluteSiteUrl } from "../src/lib/display-format";
import { bookingImageAbsolutePathFromPublicPath } from "../src/lib/booking-image-storage";

async function loadDatabaseSamples(): Promise<BookingCardRecord[]> {
  if (!process.env.DATABASE_URL) return [];

  try {
    const { prisma } = await import("../src/lib/prisma-runtime");
    const records = await prisma.publicRecordDemo.findMany({
      where: { publishStatus: "PUBLISHED" },
      orderBy: [{ imageLocalPath: "desc" }, { createdAt: "desc" }],
      take: 3,
      select: {
        slug: true,
        displayName: true,
        age: true,
        bookingDateTimeText: true,
        bookingTimeKnown: true,
        recordDate: true,
        arrestingAgency: true,
        sourceName: true,
        imageUrl: true,
        imageLocalPath: true,
      },
    });
    await prisma.$disconnect();
    return records;
  } catch (error) {
    console.warn(
      JSON.stringify({
        databaseSamplesLoaded: false,
        reason: error instanceof Error ? error.message : String(error),
      }),
    );
    return [];
  }
}

function loadDemoSamples(): BookingCardRecord[] {
  return getPublishedRecords()
    .slice(0, 3)
    .map((record) => ({
      slug: record.slug,
      displayName: record.displayName,
      age: record.age,
      bookingDateTimeText: record.bookingDateTimeText,
      bookingTimeKnown: record.bookingTimeKnown,
      recordDate: record.recordDate,
      arrestingAgency: record.arrestingAgency,
      sourceName: record.sourceName,
      imageUrl: record.imageUrl,
    }));
}

async function main() {
  const databaseSamples = await loadDatabaseSamples();
  const samples = databaseSamples.length > 0 ? databaseSamples : loadDemoSamples();

  const output = [];
  for (const sample of samples) {
    const cards = await generateBookingCardImages(sample);

    output.push({
      slug: sample.slug,
      source: databaseSamples.length > 0 ? "database" : "demo_fixture",
      previewPath: cards.previewPath,
      previewFile: bookingImageAbsolutePathFromPublicPath(cards.previewPath),
      previewUrl: absoluteSiteUrl(cards.previewPath),
      fullPath: cards.fullPath,
      fullFile: bookingImageAbsolutePathFromPublicPath(cards.fullPath),
      fullUrl: absoluteSiteUrl(cards.fullPath),
    });
  }

  console.log(JSON.stringify({ ok: true, samples: output }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
