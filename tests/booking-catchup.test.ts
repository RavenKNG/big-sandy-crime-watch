import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildBookingCatchUp,
  buildBookingCatchUpReels,
  createBookingCatchUpCaption,
  dayKeyInTimeZone,
  getBookingCatchUpConfig,
  orderBookingCatchUpRecords,
  planBookingCatchUpTiming,
  selectBookingCatchUpRecords,
  timeSlotForDay,
  type BookingCatchUpEligibleRecord,
} from "../src/lib/booking-catchup";
import { bookingImageAbsolutePathFromPublicPath, writeBookingImageFromBuffer } from "../src/lib/booking-image-storage";

const originalStorageDir = process.env.BOOKING_IMAGE_STORAGE_DIR;

afterEach(() => {
  if (originalStorageDir === undefined) delete process.env.BOOKING_IMAGE_STORAGE_DIR;
  else process.env.BOOKING_IMAGE_STORAGE_DIR = originalStorageDir;
});

async function sampleMugshot() {
  return sharp({ create: { width: 200, height: 280, channels: 3, background: "#5b6168" } }).jpeg().toBuffer();
}

async function record(index: number, withPhoto = true): Promise<BookingCatchUpEligibleRecord> {
  const slug = `catchup-test-${index}`;
  const imagePath = withPhoto ? await writeBookingImageFromBuffer(slug, ".jpg", await sampleMugshot()) : null;
  return {
    id: `record-${index}`,
    slug,
    displayName: `Catch-Up Test ${index}`,
    age: 30 + index,
    bookingDateTimeText: `2026-06-08T0${index % 10}:30:00.000Z`,
    bookingTimeKnown: true,
    recordDate: new Date(`2026-06-08T0${index % 10}:30:00.000Z`),
    arrestingAgency: "Example Agency",
    sourceName: "Example Source",
    imageUrl: imagePath,
    imageLocalPath: imagePath,
    complianceNotes: null,
    viewCount: index,
    facebookDraftUpdatedAt: new Date(`2026-06-08T1${index % 10}:00:00.000Z`),
  };
}

function config() {
  return {
    ...getBookingCatchUpConfig(),
    enabled: true,
    autoPost: false,
    times: ["06:00", "19:00"],
    maxRecords: 10,
    maxRecordsPerReel: 8,
    maxReelsPerDay: 1,
    postWindowMinutes: 90,
    targetDurationSeconds: 20,
    minDurationSeconds: 20,
    includeStaticFallback: true,
    audioFile: null,
    audioFadeSeconds: 0,
  };
}

describe("Booking Catch-Up", () => {
  it("builds a beat-planned Booking Catch-Up and silent fallback video", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-catchup-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const records = await Promise.all(Array.from({ length: 8 }, (_, index) => record(index + 1)));
    const result = await buildBookingCatchUp({ dayKey: "2026-06-08", records, config: config() });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected Booking Catch-Up build");
    expect(result.recordCount).toBe(8);
    expect(result.timing.cardDurationSeconds).toBe(2.5);
    expect(result.timing.totalDurationSeconds).toBe(20);
    expect(result.assets.posterImagePath).toContain("booking-catchup-poster-0600.jpg");
    const reelFile = bookingImageAbsolutePathFromPublicPath(result.assets.reelVideoPath);
    expect(reelFile).toBeTruthy();
    await fs.access(reelFile as string);
  }, 20000);

  it("creates factual caption copy", () => {
    const caption = createBookingCatchUpCaption("2026-06-08", undefined, {
      batchNumber: 1,
      totalBatches: 1,
      recordCount: 7,
      totalRecordCount: 7,
    });
    expect(caption).toContain("Booking Catch-Up");
    expect(caption).toContain("View full records:");
    expect(caption).toContain("An arrest does not imply guilt.");
  });

  it("uses the approved Booking Catch-Up reel card wording", async () => {
    const source = await fs.readFile(path.resolve("src/lib/booking-catchup.ts"), "utf8");
    expect(source).toContain("BIG SANDY CRIME WATCH");
    expect(source).toContain("BOOKING CATCH-UP");
    expect(source).toContain("CHARGE DETAILS:");
    expect(source).not.toContain("CHANGE DETAILS:");
    expect(source).toContain("sharp.strategy.attention");
    expect(source).not.toContain("VIEW FULL CHARGES &amp; DETAILS:");
    expect(source).not.toMatch(/Booking Report|Daily Recap|3, 2, 1|countdown/i);
  });

  it("balances the info row as booked, agency, and charge details only", async () => {
    const source = await fs.readFile(path.resolve("src/lib/booking-catchup.ts"), "utf8");
    expect(source).toContain('line x1="329"');
    expect(source).toContain('line x1="679"');
    expect(source).toContain('text x="179" y="1469"');
    expect(source).toContain('text x="504" y="1469"');
    expect(source).toContain('text x="865" y="1466"');
    expect(source).toContain("BOOKED:");
    expect(source).toContain("AGENCY:");
    expect(source).toContain("CHARGE DETAILS:");
    expect(source).not.toMatch(/>AGE:|>ARREST DATE:|>COUNTY:|>BOND:|>STATUS:/i);
  });

  it("uses only the approved simple header badge and no footer icons", async () => {
    const source = await fs.readFile(path.resolve("src/lib/booking-catchup.ts"), "utf8");
    expect(source).not.toContain("booking-catchup-badge-approved.png");
    expect(source).not.toContain("***");
    expect(source).toContain("bookingCatchUpSimpleBadge");
    expect(source).toContain("CRIME WATCH");
    expect(source).not.toContain("<path d=\"M50 0c31 20");
    expect(source).toContain("ARREST DOES NOT IMPLY GUILT.");
    expect(source).toContain("text-anchor=\"middle\"");
  });

  it("renders short, medium, and long names into 1080x1920 reel cards", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-catchup-names-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const records = await Promise.all(Array.from({ length: 8 }, (_, index) => record(index + 1)));
    records[0].displayName = "JOE FOX";
    records[1].displayName = "JONATHAN JAMES PACK";
    records[2].displayName = "ALEXANDER CHRISTOPHER MONTGOMERY-WILLIAMS";

    const result = await buildBookingCatchUpReels({ dayKey: "2026-06-14", records, config: config() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected Booking Catch-Up build");

    for (const file of result.reels[0].assets.slideFiles.slice(0, 3)) {
      const metadata = await sharp(file).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    }
  }, 20000);

  it("renders short, medium, and long agencies into 1080x1920 reel cards", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-catchup-agencies-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const agencies = [
      "PPD",
      "LPD",
      "FISH & WILDLIFE",
      "JOHNSON CO SHERIFF",
      "MARTIN CO SHERIFF",
      "BIG SANDY REGIONAL DETENTION CENTER",
    ];
    const records = await Promise.all(Array.from({ length: 8 }, async (_, index) => {
      const item = await record(index + 1);
      item.arrestingAgency = agencies[index] ?? "EXAMPLE AGENCY";
      return item;
    }));

    const result = await buildBookingCatchUpReels({ dayKey: "2026-06-15", records, config: config() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected Booking Catch-Up build");

    for (const file of result.reels[0].assets.slideFiles.slice(0, agencies.length)) {
      const metadata = await sharp(file).metadata();
      expect(metadata.width).toBe(1080);
      expect(metadata.height).toBe(1920);
    }
  }, 20000);

  it("uses the configured timezone to derive the daily key", () => {
    expect(dayKeyInTimeZone(new Date("2026-06-09T01:00:00.000Z"), "America/New_York")).toBe("2026-06-08");
  });

  it("does not back-post stale morning slots later in the day", () => {
    const staleMorning = timeSlotForDay(config(), new Date("2026-06-19T22:53:00.000Z"));
    expect(staleMorning.due).toBe(false);
    expect(staleMorning.dueSlots).toEqual([]);

    const activeEvening = timeSlotForDay(config(), new Date("2026-06-19T23:05:00.000Z"));
    expect(activeEvening.dueSlots.map((slot) => slot.time)).toEqual(["19:00"]);
  });

  it("plans exactly 8 card slides for exactly 20 seconds with no intro or outro", () => {
    const timing = planBookingCatchUpTiming(8, config());
    expect(timing.totalDurationSeconds).toBe(20);
    expect(timing.slideTimings).toHaveLength(8);
    expect(timing.slideTimings.every((slide) => slide.kind === "card")).toBe(true);
    expect(timing.slideTimings[0]).toMatchObject({ kind: "card", startSeconds: 0, endSeconds: 2.5, durationSeconds: 2.5 });
    expect(timing.slideTimings[7]).toMatchObject({ kind: "card", startSeconds: 17.5, endSeconds: 20, durationSeconds: 2.5 });
    expect(timing.slideTimings.map((slide) => slide.text).join(" ")).not.toMatch(/Booking Catch-Up STARTING IN|FULL DETAILS/);
  });

  it("builds one 8-record reel output from the newest candidate pool", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-catchup-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;
    const records = await Promise.all(Array.from({ length: 13 }, (_, index) => record(index + 1)));
    const result = await buildBookingCatchUpReels({ dayKey: "2026-06-13", records, config: config() });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected Booking Catch-Up build");
    expect(result.reels).toHaveLength(1);
    expect(result.reels[0].recordCount).toBe(8);
    expect(result.reels[0].timing.totalDurationSeconds).toBe(20);
  }, 40000);

  it("selects exactly 8 records and always includes the newest eligible booking", async () => {
    const records = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const item = await record(index + 1, true);
      return { ...item, viewCount: index + 1 };
    }));
    const newest = { ...records[9], displayName: "Newest Low View", viewCount: 0, facebookDraftUpdatedAt: new Date("2026-06-20T10:00:00.000Z") };

    const selected = selectBookingCatchUpRecords([...records.slice(0, 9), newest], "06:00");

    expect(selected).toHaveLength(8);
    expect(selected.some((item) => item.id === newest.id)).toBe(true);
  });

  it("uses stored view count as popularity when ordering selected bookings", async () => {
    const lessPopularPhoto = { ...(await record(2, true)), displayName: "Photo Low", viewCount: 10 };
    const morePopularPhoto = { ...(await record(3, true)), displayName: "Photo High", viewCount: 50 };

    expect(orderBookingCatchUpRecords([lessPopularPhoto, morePopularPhoto]).map((item) => item.displayName))
      .toEqual(["Photo High", "Photo Low"]);
  });

  it("starts the morning reel with the most popular eligible booking", async () => {
    const records = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const item = await record(index + 1, true);
      return { ...item, viewCount: index === 4 ? 500 : index + 1 };
    }));

    expect(selectBookingCatchUpRecords(records, "06:00")[0].displayName).toBe("Catch-Up Test 5");
  });

  it("starts the evening reel with second-most-popular when it would duplicate the morning opener", async () => {
    const records = await Promise.all(Array.from({ length: 10 }, async (_, index) => {
      const item = await record(index + 1, true);
      return { ...item, viewCount: index === 4 ? 500 : index === 2 ? 400 : index + 1 };
    }));

    const morning = selectBookingCatchUpRecords(records, "06:00");
    const evening = selectBookingCatchUpRecords(records, "19:00");

    expect(morning[0].displayName).toBe("Catch-Up Test 5");
    expect(evening[0].displayName).toBe("Catch-Up Test 3");
    expect(evening.some((item) => item.id === records[9].id)).toBe(true);
  });
});
