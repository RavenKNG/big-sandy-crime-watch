import sharp from "sharp";
import { generateBookingCardImages } from "../src/lib/booking-card-generator";
import { absoluteSiteUrl } from "../src/lib/display-format";
import { bookingImageAbsolutePathFromPublicPath, writeBookingImageFromBuffer } from "../src/lib/booking-image-storage";

async function sampleMugshot(background: string, shirt: string) {
  return sharp({
    create: {
      width: 760,
      height: 920,
      channels: 3,
      background,
    },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="760" height="920" xmlns="http://www.w3.org/2000/svg">
            <rect width="760" height="920" fill="${background}"/>
            ${Array.from({ length: 11 })
              .map((_, index) => `<line x1="70" y1="${120 + index * 56}" x2="330" y2="${120 + index * 56}" stroke="rgba(255,255,255,0.35)" stroke-width="6"/>`)
              .join("")}
            <circle cx="455" cy="270" r="122" fill="#1e242b"/>
            <path d="M290 760c30-180 140-260 265-260s235 80 265 260Z" fill="${shirt}"/>
            <rect x="288" y="492" width="284" height="270" rx="75" fill="${shirt}"/>
          </svg>`,
        ),
      },
    ])
    .jpeg({ quality: 92 })
    .toBuffer();
}

async function main() {
  const samples = [
    {
      slug: "sample-booking-card-short-name",
      displayName: "Justin Caldwell",
      age: 35,
      bookingDateTimeText: "2026-06-05T09:15:00.000Z",
      bookingTimeKnown: true,
      arrestingAgency: "COURT",
      mugshot: await sampleMugshot("#60686c", "#d75a22"),
    },
    {
      slug: "sample-booking-card-long-name",
      displayName: "Alexandria McKenzie Worthington",
      age: 42,
      bookingDateTimeText: "06/05/2026",
      bookingTimeKnown: false,
      arrestingAgency: "Very Long Regional Court Services Agency",
      mugshot: await sampleMugshot("#555f64", "#c94d1f"),
    },
    {
      slug: "sample-booking-card-no-image",
      displayName: "No Image Example",
      age: null,
      bookingDateTimeText: "06/05/2026",
      bookingTimeKnown: false,
      arrestingAgency: "Example Public Roster",
      mugshot: null,
    },
  ];

  const output = [];
  for (const sample of samples) {
    const imageUrl = sample.mugshot
      ? await writeBookingImageFromBuffer(sample.slug, ".jpg", sample.mugshot)
      : undefined;
    const cards = await generateBookingCardImages({ ...sample, imageUrl });

    output.push({
      slug: sample.slug,
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
