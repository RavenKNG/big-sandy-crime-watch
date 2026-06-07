import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { generateBookingCardImages } from "../src/lib/booking-card-generator";
import { bookingImageAbsolutePathFromPublicPath, writeBookingImageFromBuffer } from "../src/lib/booking-image-storage";

const originalStorageDir = process.env.BOOKING_IMAGE_STORAGE_DIR;

afterEach(() => {
  process.env.BOOKING_IMAGE_STORAGE_DIR = originalStorageDir;
});

async function expectPng(publicPath: string) {
  const filePath = bookingImageAbsolutePathFromPublicPath(publicPath);
  expect(filePath).toBeTruthy();
  const bytes = await fs.readFile(filePath as string);
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
}

describe("booking card generator", () => {
  it("writes preview and full booking report cards", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-card-images-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const mugshot = await sharp({
      create: {
        width: 640,
        height: 820,
        channels: 3,
        background: "#5b6168",
      },
    })
      .composite([
        {
          input: Buffer.from(
            `<svg width="640" height="820" xmlns="http://www.w3.org/2000/svg">
              <rect x="70" y="50" width="500" height="700" fill="#6f767f"/>
              <circle cx="320" cy="260" r="115" fill="#1f2329"/>
              <rect x="205" y="380" width="230" height="250" rx="70" fill="#d95a22"/>
            </svg>`,
          ),
        },
      ])
      .jpeg()
      .toBuffer();
    const mugshotPath = await writeBookingImageFromBuffer("sample-card-record", ".jpg", mugshot);

    const cards = await generateBookingCardImages({
      slug: "sample-card-record",
      displayName: "Example Long Hyphenated Person",
      age: 33,
      bookingDateTimeText: "2026-01-15T12:30:00.000Z",
      bookingTimeKnown: true,
      arrestingAgency: "Very Long Example Court Agency Name",
      imageUrl: mugshotPath,
    });

    expect(cards.previewPath).toBe("/booking-images/sample-card-record/booking-card-preview.png");
    expect(cards.fullPath).toBe("/booking-images/sample-card-record/booking-card-full.png");
    await expectPng(cards.previewPath);
    await expectPng(cards.fullPath);
  });

  it("generates usable cards when the mugshot is missing", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-card-images-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;

    const cards = await generateBookingCardImages({
      slug: "missing-mugshot-record",
      displayName: "No Image Person",
      bookingDateTimeText: "01/15/2026",
      bookingTimeKnown: false,
      sourceName: "Example Public Roster",
    });

    await expectPng(cards.previewPath);
    await expectPng(cards.fullPath);
  });
});
