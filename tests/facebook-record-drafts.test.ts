import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import { writeBookingImageFromBuffer } from "../src/lib/booking-image-storage";
import { createFacebookRecordDraftPayload, type FacebookRecordDraftRecord } from "../src/lib/facebook-record-drafts";

const originalStorageDir = process.env.BOOKING_IMAGE_STORAGE_DIR;

afterEach(() => {
  if (originalStorageDir === undefined) delete process.env.BOOKING_IMAGE_STORAGE_DIR;
  else process.env.BOOKING_IMAGE_STORAGE_DIR = originalStorageDir;
});

function record(overrides: Partial<FacebookRecordDraftRecord> = {}): FacebookRecordDraftRecord {
  return {
    slug: "example-record",
    displayName: "Example Person",
    age: 35,
    bookingDateTimeText: "06/18/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-18T04:00:00.000Z"),
    arrestingAgency: "Example Agency",
    sourceName: "Example Source",
    imageUrl: null,
    imageLocalPath: null,
    charges: [{ offense: "Listed charge", chargeDescription: "Listed charge" }],
    ...overrides,
  };
}

async function sampleMugshot() {
  return sharp({ create: { width: 200, height: 280, channels: 3, background: "#68717c" } }).jpeg().toBuffer();
}

describe("Facebook record draft payloads", () => {
  it("uses the confirmed mugshot image instead of a generated booking card", async () => {
    process.env.BOOKING_IMAGE_STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-fb-draft-"));
    const mugshotPath = await writeBookingImageFromBuffer("example-record", ".jpg", await sampleMugshot());

    const payload = await createFacebookRecordDraftPayload(
      record({ imageUrl: mugshotPath, imageLocalPath: mugshotPath }),
      "https://bigsandycrimewatch.com",
    );

    expect(payload.imageUrl).toBe("https://bigsandycrimewatch.com/booking-images/example-record/mugshot.jpg");
    expect(payload.imageUrl).not.toContain("booking-card-preview");
    expect(payload.errorMessage).toBeNull();
  });

  it("holds booking drafts when no mugshot is confirmed", async () => {
    process.env.BOOKING_IMAGE_STORAGE_DIR = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-fb-draft-"));

    const payload = await createFacebookRecordDraftPayload(record(), "https://bigsandycrimewatch.com");

    expect(payload.imageUrl).toBeNull();
    expect(payload.errorMessage).toContain("no confirmed mugshot");
  });
});
