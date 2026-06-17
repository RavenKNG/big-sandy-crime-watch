import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildDailyBookingRecap,
  buildDailyBookingRecapReels,
  createDailyBookingRecapCaption,
  dayKeyInTimeZone,
  getDailyRecapConfig,
  planDailyRecapTiming,
  splitDailyRecapRecords,
  type DailyRecapEligibleRecord,
} from "../src/lib/daily-booking-recap";
import { bookingImageAbsolutePathFromPublicPath, writeBookingImageFromBuffer } from "../src/lib/booking-image-storage";

const originalStorageDir = process.env.BOOKING_IMAGE_STORAGE_DIR;

afterEach(() => {
  if (originalStorageDir === undefined) delete process.env.BOOKING_IMAGE_STORAGE_DIR;
  else process.env.BOOKING_IMAGE_STORAGE_DIR = originalStorageDir;
});

async function sampleMugshot() {
  return sharp({ create: { width: 200, height: 280, channels: 3, background: "#5b6168" } }).jpeg().toBuffer();
}

async function record(index: number, withPhoto = true): Promise<DailyRecapEligibleRecord> {
  const slug = `recap-test-${index}`;
  const imagePath = withPhoto ? await writeBookingImageFromBuffer(slug, ".jpg", await sampleMugshot()) : null;
  return {
    id: `record-${index}`,
    slug,
    displayName: `Recap Test ${index}`,
    age: 30 + index,
    bookingDateTimeText: `2026-06-08T0${index % 10}:30:00.000Z`,
    bookingTimeKnown: true,
    recordDate: new Date(`2026-06-08T0${index % 10}:30:00.000Z`),
    arrestingAgency: "Example Agency",
    sourceName: "Example Source",
    imageUrl: imagePath,
    imageLocalPath: imagePath,
    complianceNotes: null,
    facebookDraftUpdatedAt: new Date(`2026-06-08T1${index % 10}:00:00.000Z`),
  };
}

function config() {
  return {
    ...getDailyRecapConfig(),
    enabled: true,
    autoPost: false,
    maxRecords: 28,
    maxRecordsPerReel: 7,
    maxReelsPerDay: 4,
    targetDurationSeconds: 15,
    minDurationSeconds: 10.5,
    includeStaticFallback: true,
    audioFile: null,
  };
}

describe("daily booking recap", () => {
  it("builds a beat-planned recap and silent fallback video", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-recap-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const records = await Promise.all([record(1), record(2), record(3), record(4)]);
    const result = await buildDailyBookingRecap({ dayKey: "2026-06-08", records, config: config() });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected recap build");
    expect(result.recordCount).toBe(4);
    expect(result.timing.cardBeatsPerRecord).toBe(5);
    expect(result.timing.totalDurationSeconds).toBeGreaterThanOrEqual(10.5);
    expect(result.assets.posterImagePath).toContain("daily-booking-recap-poster.jpg");
    const reelFile = bookingImageAbsolutePathFromPublicPath(result.assets.reelVideoPath);
    expect(reelFile).toBeTruthy();
    await fs.access(reelFile as string);
  }, 20000);

  it("creates factual caption copy", () => {
    const caption = createDailyBookingRecapCaption("2026-06-08", undefined, {
      batchNumber: 1,
      totalBatches: 1,
      recordCount: 7,
      totalRecordCount: 7,
    });
    expect(caption).toContain("DAILY BOOKING RECAP");
    expect(caption).toContain("View full records:");
    expect(caption).toContain("An arrest does not imply guilt.");
  });

  it("uses the configured timezone to derive the daily key", () => {
    expect(dayKeyInTimeZone(new Date("2026-06-09T01:00:00.000Z"), "America/New_York")).toBe("2026-06-08");
  });

  it.each([
    [1, [1]],
    [2, [2]],
    [7, [7]],
    [8, [4, 4]],
    [13, [7, 6]],
    [14, [7, 7]],
    [15, [5, 5, 5]],
    [20, [7, 7, 6]],
  ])("splits %i records into balanced capped batches", async (count, expected) => {
    const records = await Promise.all(Array.from({ length: count }, (_, index) => record(index + 1, false)));
    expect(splitDailyRecapRecords(records, config()).map((batch) => batch.length)).toEqual(expected);
  });

  it("keeps timing beat-aligned and above minimum for 1-7 records", () => {
    for (let count = 1; count <= 7; count += 1) {
      const timing = planDailyRecapTiming(count, config());
      expect(timing.totalDurationSeconds).toBeGreaterThanOrEqual(10.5);
      for (const slide of timing.slideTimings) {
        expect(Number((slide.durationSeconds / timing.beatIntervalSeconds).toFixed(3))).toBeCloseTo(slide.beats, 2);
      }
    }
  });

  it("counts the countdown as first-card screen time", () => {
    const timing = planDailyRecapTiming(6, config());
    expect(timing.slideTimings[0]).toMatchObject({ text: "DAILY RECAP STARTING IN", startSeconds: 0, endSeconds: 0.928 });
    expect(timing.slideTimings[1]).toMatchObject({ text: "3", startSeconds: 0.928, endSeconds: 1.856 });
    expect(timing.slideTimings[2]).toMatchObject({ text: "2", startSeconds: 1.856, endSeconds: 2.784 });
    expect(timing.slideTimings[3]).toMatchObject({ text: "1", startSeconds: 2.784, endSeconds: 3.712 });
    expect(timing.slideTimings[4]).toMatchObject({ kind: "card", startSeconds: 3.712, endSeconds: 4.64 });
    expect(timing.slideTimings[5]).toMatchObject({ kind: "card", startSeconds: 4.64 });
  });

  it("builds split reel outputs for 13 records", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-recap-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const records = await Promise.all(Array.from({ length: 13 }, (_, index) => record(index + 1)));
    const result = await buildDailyBookingRecapReels({ dayKey: "2026-06-13", records, config: config() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected recap build");
    expect(result.reels.map((reel) => reel.recordCount)).toEqual([7, 6]);
  }, 40000);
});
