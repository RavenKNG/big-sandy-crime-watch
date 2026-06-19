import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { getDb } from "./db";
import { generateBookingCardImages } from "./booking-card-generator";
import {
  bookingImageAbsolutePathFromPublicPath,
  bookingCatchUpAssetPublicPath,
  writeBookingCatchUpAssetFromBuffer,
} from "./booking-image-storage";
import { resolveBookingPhoto } from "./booking-photo";
import { markFacebookPostResult } from "./facebook-connection";

const BOOKING_CATCHUP_TARGET_TYPE = "booking_catchup";
const BOOKING_CATCHUP_RECORD_ACTION_PREFIX = "BOOKING_CATCHUP_INCLUDED:";
const BOOKING_CATCHUP_REEL_ACTION_PREFIX = "BOOKING_CATCHUP_REEL_POSTED:";
const BOOKING_CATCHUP_URL_CAMPAIGN = "booking_catchup";
const AUDIO_TITLE = "Late Night Drive (Loop)";
const AUDIO_ARTIST = "Marshall Rogalski";
const AUDIO_SOURCE = "Meta Sound Collection";
const AUDIO_ASSET_ID = "462993695415494";
const BOOKING_CATCHUP_MORNING_TIME = "06:00";
const BOOKING_CATCHUP_EVENING_TIME = "19:00";
const BOOKING_CATCHUP_RECORD_COUNT = 8;
const BOOKING_CATCHUP_CANDIDATE_POOL_SIZE = 10;
const BOOKING_CATCHUP_CARD_DURATION_SECONDS = 2.5;
const BOOKING_CATCHUP_TOTAL_DURATION_SECONDS = 20;

export type BookingCatchUpEligibleRecord = {
  id: string;
  slug: string;
  displayName: string;
  age: number | null;
  bookingDateTimeText: string | null;
  bookingTimeKnown: boolean;
  recordDate: Date;
  arrestingAgency: string | null;
  sourceName: string;
  imageUrl: string | null;
  imageLocalPath: string | null;
  complianceNotes: string | null;
  viewCount: number;
  facebookDraftUpdatedAt: Date;
};

export type BookingCatchUpConfig = {
  enabled: boolean;
  autoPost: boolean;
  time: string;
  times: string[];
  timeZone: string;
  format: "reel";
  maxRecords: number;
  maxRecordsPerReel: number;
  maxReelsPerDay: number;
  minDurationSeconds: number;
  targetDurationSeconds: number;
  includeStaticFallback: boolean;
  hookBeats: number;
  outroBeats: number;
  audioFile: string | null;
  audioTitle: string;
  audioArtist: string;
  audioSource: string;
  audioAssetId: string;
  audioVolume: number;
  audioFadeSeconds: number;
  audioBpm: number;
  audioBeatOffsetSeconds: number;
  includeAudioAttributionInCaption: boolean;
};

export type BookingCatchUpSlidePlan = {
  kind: "hook" | "card" | "outro";
  text: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  beats: number;
  file?: string;
  publicPath?: string;
};

export type BookingCatchUpReelBuild = {
  ok: true;
  skipped: false;
  dayKey: string;
  timeZone: string;
  dateLabel: string;
  slotTime: string;
  slotId: string;
  caption: string;
  siteUrl: string;
  recordCount: number;
  totalRecordCount: number;
  batchNumber: number;
  totalBatches: number;
  timing: BookingCatchUpTimingPlan;
  records: Array<{
    id: string;
    slug: string;
    displayName: string;
    photoStatus: "available" | "unavailable";
    bookingTimeText: string;
  }>;
  assets: {
    reelVideoPath: string;
    reelVideoFile: string;
    posterImagePath: string | null;
    posterImageFile: string | null;
    slidePaths: string[];
    slideFiles: string[];
  };
};

export type BookingCatchUpBuildResult =
  | {
      ok: false;
      skipped: true;
      reason: string;
      dayKey: string;
      timeZone: string;
      dateLabel: string;
    }
  | BookingCatchUpReelBuild;

export type BookingCatchUpTimingPlan = {
  bpm: number;
  beatIntervalSeconds: number;
  beatOffsetSeconds: number;
  hookBeats: number;
  cardBeatsPerRecord: number;
  outroBeats: number;
  hookDurationSeconds: number;
  cardDurationSeconds: number;
  outroDurationSeconds: number;
  totalDurationSeconds: number;
  batchSize: number;
  slideTimings: BookingCatchUpSlidePlan[];
};

function envBool(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

function envNum(name: string, fallback: number) {
  const value = Number.parseFloat(process.env[name] || "");
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function envInt(name: string, fallback: number) {
  return Math.max(1, Math.trunc(envNum(name, fallback)));
}

function envTimes(name: string, fallback: string[]) {
  const values = (process.env[name] || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

export function getBookingCatchUpConfig(): BookingCatchUpConfig {
  const times = envTimes("BOOKING_CATCHUP_TIMES", [BOOKING_CATCHUP_MORNING_TIME, BOOKING_CATCHUP_EVENING_TIME]);
  return {
    enabled: envBool("BOOKING_CATCHUP_ENABLED", false),
    autoPost: envBool("BOOKING_CATCHUP_AUTO_POST", false),
    time: process.env.BOOKING_CATCHUP_TIME || times[0],
    times,
    timeZone: process.env.BOOKING_CATCHUP_TIMEZONE || "America/New_York",
    format: "reel",
    maxRecords: envInt("BOOKING_CATCHUP_MAX_RECORDS", BOOKING_CATCHUP_CANDIDATE_POOL_SIZE),
    maxRecordsPerReel: envInt("BOOKING_CATCHUP_MAX_RECORDS_PER_REEL", BOOKING_CATCHUP_RECORD_COUNT),
    maxReelsPerDay: envInt("BOOKING_CATCHUP_MAX_REELS_PER_DAY", 1),
    minDurationSeconds: envNum("BOOKING_CATCHUP_MIN_DURATION_SECONDS", BOOKING_CATCHUP_TOTAL_DURATION_SECONDS),
    targetDurationSeconds: envNum("BOOKING_CATCHUP_TARGET_DURATION_SECONDS", BOOKING_CATCHUP_TOTAL_DURATION_SECONDS),
    includeStaticFallback: envBool("BOOKING_CATCHUP_INCLUDE_STATIC_FALLBACK", true),
    hookBeats: 0,
    outroBeats: 0,
    audioFile: process.env.BOOKING_CATCHUP_AUDIO_FILE || null,
    audioTitle: process.env.BOOKING_CATCHUP_AUDIO_TITLE || AUDIO_TITLE,
    audioArtist: process.env.BOOKING_CATCHUP_AUDIO_ARTIST || AUDIO_ARTIST,
    audioSource: process.env.BOOKING_CATCHUP_AUDIO_SOURCE || AUDIO_SOURCE,
    audioAssetId: process.env.BOOKING_CATCHUP_AUDIO_ASSET_ID || AUDIO_ASSET_ID,
    audioVolume: envNum("BOOKING_CATCHUP_AUDIO_VOLUME", 0.3),
    audioFadeSeconds: envNum("BOOKING_CATCHUP_AUDIO_FADE_SECONDS", 0),
    audioBpm: envNum("BOOKING_CATCHUP_AUDIO_BPM", 129.310345),
    audioBeatOffsetSeconds: Number.parseFloat(process.env.BOOKING_CATCHUP_AUDIO_BEAT_OFFSET_SECONDS || "0") || 0,
    includeAudioAttributionInCaption: envBool("BOOKING_CATCHUP_INCLUDE_AUDIO_ATTRIBUTION_IN_CAPTION", false),
  };
}

function formatParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
}

export function dayKeyInTimeZone(date: Date, timeZone: string) {
  const parts = formatParts(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function dateLabelForDayKey(dayKey: string, timeZone: string) {
  const parsed = new Date(`${dayKey}T12:00:00Z`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

function bookingCatchUpSiteUrl(site = process.env.SITE_URL || "https://bigsandycrimewatch.com") {
  const url = new URL("/today", `${site.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: BOOKING_CATCHUP_URL_CAMPAIGN,
    utm_content: "reel",
  }).toString();
  return url.toString();
}

export function createBookingCatchUpCaption(dayKey: string, site?: string, part?: { batchNumber: number; totalBatches: number; recordCount: number; totalRecordCount: number }) {
  const config = getBookingCatchUpConfig();
  const dateLabel = dateLabelForDayKey(dayKey, config.timeZone);
  const partLine = part && part.totalBatches > 1
    ? `Part ${part.batchNumber} of ${part.totalBatches}: ${part.recordCount} of ${part.totalRecordCount} booking records.`
    : part
      ? `${part.recordCount} booking record${part.recordCount === 1 ? "" : "s"} in this Booking Catch-Up.`
      : "Booking Catch-Up";
  return [
    `Booking Catch-Up - ${dateLabel}`,
    "",
    partLine,
    "",
    "View full records:",
    bookingCatchUpSiteUrl(site),
    "",
    "An arrest does not imply guilt. All individuals are presumed innocent unless proven guilty in court.",
    config.includeAudioAttributionInCaption ? `Music: ${config.audioTitle} - ${config.audioArtist} / ${config.audioSource}` : "",
  ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
}

function slotIdForTime(time: string) {
  return time.replace(/[^0-9]/g, "");
}

function timeSlotForDay(config: BookingCatchUpConfig, now: Date) {
  const parts = formatParts(now, config.timeZone);
  const currentMinutes = Number.parseInt(parts.hour || "0", 10) * 60 + Number.parseInt(parts.minute || "0", 10);
  const slots = config.times.map((time) => {
    const [scheduledHour, scheduledMinute] = time.split(":").map((value) => Number.parseInt(value, 10));
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
    return {
      time,
      slotId: slotIdForTime(time),
      due: currentMinutes >= scheduledMinutes,
    };
  });
  const dueSlots = slots.filter((slot) => slot.due);
  const activeDueSlots = dueSlots.length > 0 ? [dueSlots[dueSlots.length - 1]] : [];
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    due: activeDueSlots.length > 0,
    slots,
    dueSlots: activeDueSlots,
  };
}

function normalizeFfmpegPath() {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path.");
  return ffmpegPath;
}

function concatFileLine(filePath: string) {
  return `file '${filePath.replace(/\\/g, "/").replace(/'/g, "'\\''")}'`;
}

export async function runFfmpeg(args: string[]) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(normalizeFfmpegPath(), args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr}`));
    });
  });
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createBookingCatchUpCardSlide(cardPublicPath: string, title: string) {
  const cardFile = bookingImageAbsolutePathFromPublicPath(cardPublicPath);
  if (!cardFile) throw new Error(`Unable to resolve booking card file for ${cardPublicPath}`);

  const card = sharp(cardFile);
  const cardBuffer = await card.png().toBuffer();
  const background = await sharp(cardBuffer)
    .resize(1080, 1920, { fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.72, saturation: 0.85 })
    .composite([{ input: Buffer.from('<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg"><rect width="1080" height="1920" fill="rgba(5,8,12,0.54)"/></svg>') }])
    .png()
    .toBuffer();

  const framedCard = await sharp(cardBuffer)
    .resize(980, 980, { fit: "contain", background: "#0b0d12" })
    .extend({
      top: 24,
      bottom: 24,
      left: 24,
      right: 24,
      background: "#0b0d12",
    })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([
      { input: framedCard, top: 390, left: 26 },
      {
        input: Buffer.from(
          `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
            <text x="540" y="152" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="52" fill="#f5f7fb">BIG SANDY CRIME WATCH</text>
            <rect x="290" y="190" width="500" height="54" fill="#b71723"/>
            <text x="540" y="228" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="30" fill="#ffffff" letter-spacing="4">Booking Catch-Up</text>
            <text x="540" y="1500" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="42" fill="#ffffff">${escapeXml(title)}</text>
            <text x="540" y="1836" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="26" fill="#ffffff" letter-spacing="2">BIGSANDYCRIMEWATCH.COM</text>
            <text x="540" y="1886" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="22" fill="#ffffff" letter-spacing="1.5">ARREST DOES NOT IMPLY GUILT.</text>
          </svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

function bookingTimeText(record: Pick<BookingCatchUpEligibleRecord, "bookingDateTimeText" | "recordDate" | "bookingTimeKnown">) {
  if (record.bookingTimeKnown === false) return "N/A";
  const value = record.bookingDateTimeText || record.recordDate;
  const date = value instanceof Date ? value : value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

async function findEligiblePostedRecords(_dayKey: string, config: BookingCatchUpConfig) {
  const db = getDb();
  const recentDrafts = await db.facebookDraft.findMany({
    where: { status: "POSTED", recordId: { not: null } },
    orderBy: { createdAt: "desc" },
    take: Math.max(config.maxRecords, BOOKING_CATCHUP_CANDIDATE_POOL_SIZE) * 3,
    include: {
      record: {
        select: {
          id: true,
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
          complianceNotes: true,
          viewCount: true,
          publishStatus: true,
        },
      },
    },
  });

  const deduped = new Map<string, BookingCatchUpEligibleRecord>();
  for (const draft of recentDrafts) {
    if (!draft.record || draft.record.publishStatus !== "PUBLISHED") continue;
    if (deduped.has(draft.record.id)) continue;
    const photo = await resolveBookingPhoto(draft.record);
    if (photo.status !== "available") continue;
    deduped.set(draft.record.id, {
      id: draft.record.id,
      slug: draft.record.slug,
      displayName: draft.record.displayName,
      age: draft.record.age,
      bookingDateTimeText: draft.record.bookingDateTimeText,
      bookingTimeKnown: draft.record.bookingTimeKnown,
      recordDate: draft.record.recordDate,
      arrestingAgency: draft.record.arrestingAgency,
      sourceName: draft.record.sourceName,
      imageUrl: photo.status === "available" ? photo.imagePathOrUrl : null,
      imageLocalPath: photo.status === "available" ? photo.imagePathOrUrl : null,
      complianceNotes: draft.record.complianceNotes,
      viewCount: draft.record.viewCount,
      facebookDraftUpdatedAt: draft.createdAt,
    });
  }
  return [...deduped.values()]
    .sort((a, b) => b.facebookDraftUpdatedAt.getTime() - a.facebookDraftUpdatedAt.getTime())
    .slice(0, Math.max(config.maxRecords, BOOKING_CATCHUP_CANDIDATE_POOL_SIZE));
}

export function orderBookingCatchUpRecords(records: BookingCatchUpEligibleRecord[]) {
  return [...records].sort((a, b) => {
    if (b.viewCount !== a.viewCount) return b.viewCount - a.viewCount;
    return b.facebookDraftUpdatedAt.getTime() - a.facebookDraftUpdatedAt.getTime();
  });
}

export function selectBookingCatchUpRecords(records: BookingCatchUpEligibleRecord[], slotTime = BOOKING_CATCHUP_MORNING_TIME) {
  const newestPool = [...records]
    .filter((record) => Boolean(record.imageUrl || record.imageLocalPath))
    .sort((a, b) => b.facebookDraftUpdatedAt.getTime() - a.facebookDraftUpdatedAt.getTime())
    .slice(0, BOOKING_CATCHUP_CANDIDATE_POOL_SIZE);
  if (newestPool.length < BOOKING_CATCHUP_RECORD_COUNT) return [];

  const newest = newestPool[0];
  const selectedByPopularity = orderBookingCatchUpRecords(newestPool).slice(0, BOOKING_CATCHUP_RECORD_COUNT);
  if (!selectedByPopularity.some((record) => record.id === newest.id)) {
    selectedByPopularity[selectedByPopularity.length - 1] = newest;
  }

  const ordered = orderBookingCatchUpRecords(selectedByPopularity);
  const eveningSlot = slotIdForTime(slotTime) === slotIdForTime(BOOKING_CATCHUP_EVENING_TIME);
  if (eveningSlot && ordered.length > 1) {
    const second = ordered[1];
    return [second, ordered[0], ...ordered.slice(2)];
  }
  return ordered;
}

export function planBookingCatchUpTiming(batchSize: number, config = getBookingCatchUpConfig()): BookingCatchUpTimingPlan {
  const beatIntervalSeconds = Number((60 / config.audioBpm).toFixed(6));
  const cardDurationSeconds = BOOKING_CATCHUP_CARD_DURATION_SECONDS;
  const slideTimings: BookingCatchUpSlidePlan[] = [];
  let cursor = 0;
  const push = (kind: BookingCatchUpSlidePlan["kind"], text: string, durationSeconds: number) => {
    const startSeconds = Number(cursor.toFixed(3));
    cursor += durationSeconds;
    slideTimings.push({ kind, text, beats: 0, startSeconds, endSeconds: Number(cursor.toFixed(3)), durationSeconds });
  };

  for (let index = 0; index < batchSize; index += 1) {
    push("card", `BOOKING CARD ${index + 1} OF ${batchSize}`, cardDurationSeconds);
  }

  return {
    bpm: config.audioBpm,
    beatIntervalSeconds,
    beatOffsetSeconds: config.audioBeatOffsetSeconds,
    hookBeats: 0,
    cardBeatsPerRecord: 0,
    outroBeats: 0,
    hookDurationSeconds: 0,
    cardDurationSeconds,
    outroDurationSeconds: 0,
    totalDurationSeconds: Number(cursor.toFixed(3)),
    batchSize,
    slideTimings,
  };
}

async function readableAudio(config: BookingCatchUpConfig) {
  if (!config.audioFile) return null;
  try {
    const stat = await fs.stat(config.audioFile);
    return stat.isFile() && stat.size > 0 ? config.audioFile : null;
  } catch {
    return null;
  }
}

function audioArgs(config: BookingCatchUpConfig, audioFile: string | null, totalDurationSeconds: number) {
  if (!audioFile) {
    return {
      args: ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"],
      filterArgs: [] as string[],
      audioMapped: false,
    };
  }
  const fade = Math.min(config.audioFadeSeconds, totalDurationSeconds / 2);
  const fadeOutStart = Math.max(0, totalDurationSeconds - fade);
  const filter = fade > 0
    ? `volume=${config.audioVolume},afade=t=in:st=0:d=${fade},afade=t=out:st=${fadeOutStart}:d=${fade}`
    : `volume=${config.audioVolume}`;
  return {
    args: ["-stream_loop", "-1", "-i", audioFile],
    filterArgs: [
      "-filter:a",
      filter,
    ],
    audioMapped: true,
  };
}

async function renderVideoFromSlides(input: {
  dayKey: string;
  slideFiles: string[];
  slideDurations: number[];
  outputFile: string;
  timing: BookingCatchUpTimingPlan;
  config: BookingCatchUpConfig;
}) {
  const concatFile = path.join(os.tmpdir(), `bscw-booking-catchup-${input.dayKey}-${Date.now()}.txt`);
  const concatLines = input.slideFiles.flatMap((file, index) =>
    index < input.slideFiles.length - 1
      ? [concatFileLine(file), `duration ${input.slideDurations[index]}`]
      : [concatFileLine(file), `duration ${input.slideDurations[index]}`, concatFileLine(file)],
  );
  await fs.writeFile(concatFile, `${concatLines.join("\n")}\n`, "utf8");
  const audioFile = await readableAudio(input.config);
  const audio = audioArgs(input.config, audioFile, input.timing.totalDurationSeconds);
  const args = [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    concatFile,
    ...audio.args,
    "-t",
    String(input.timing.totalDurationSeconds),
    "-shortest",
    "-r",
    "30",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "27",
    "-pix_fmt",
    "yuv420p",
    ...audio.filterArgs,
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    input.outputFile,
  ];
  try {
    await runFfmpeg(args);
  } finally {
    await fs.rm(concatFile, { force: true });
  }
  return { audioFile, audioMapped: audio.audioMapped, ffmpegArgs: args };
}

export async function buildBookingCatchUpReels(options: {
  dayKey?: string;
  slotTime?: string;
  siteUrl?: string;
  records?: BookingCatchUpEligibleRecord[];
  config?: BookingCatchUpConfig;
}) {
  const config = options.config ?? getBookingCatchUpConfig();
  const dayKey = options.dayKey ?? dayKeyInTimeZone(new Date(), config.timeZone);
  const slotTime = options.slotTime ?? config.times[0] ?? BOOKING_CATCHUP_MORNING_TIME;
  const slotId = slotIdForTime(slotTime);
  const dateLabel = dateLabelForDayKey(dayKey, config.timeZone);
  const records = options.records ?? (await findEligiblePostedRecords(dayKey, config));
  const selectedRecords = selectBookingCatchUpRecords(records, slotTime);
  if (selectedRecords.length !== BOOKING_CATCHUP_RECORD_COUNT) {
    return { ok: false as const, skipped: true as const, reason: "Fewer than 8 Facebook-posted booking records with available mugshots were eligible for this Booking Catch-Up.", dayKey, timeZone: config.timeZone, dateLabel };
  }

  const builds: BookingCatchUpReelBuild[] = [];
  const batches = [selectedRecords];
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;
    const totalBatches = batches.length;
    const timing = planBookingCatchUpTiming(batch.length, config);
    const slideFiles: string[] = [];
    const slidePaths: string[] = [];
    const selected = [];
    const cardSlideFiles: string[] = [];
    const cardSlidePaths: string[] = [];

    for (let index = 0; index < batch.length; index += 1) {
      const record = batch[index];
      const cards = await generateBookingCardImages(record);
      const photo = await resolveBookingPhoto(record);
      const slide = await createBookingCatchUpCardSlide(cards.fullPath, record.displayName);
      const slideName = `part-${batchNumber}-card-${String(index + 1).padStart(2, "0")}.png`;
      const slidePath = await writeBookingCatchUpAssetFromBuffer(dayKey, slideName, slide);
      const slideFile = bookingImageAbsolutePathFromPublicPath(slidePath);
      if (!slideFile) throw new Error(`Unable to resolve slide file for ${slidePath}`);
      cardSlidePaths.push(slidePath);
      cardSlideFiles.push(slideFile);
      selected.push({ id: record.id, slug: record.slug, displayName: record.displayName, photoStatus: photo.status, bookingTimeText: bookingTimeText(record) });
    }

    for (let index = 0; index < cardSlideFiles.length; index += 1) {
      const timingIndex = index;
      timing.slideTimings[timingIndex].text = `${batch[index].displayName} / ${index + 1} OF ${batch.length}`;
      timing.slideTimings[timingIndex].file = cardSlideFiles[index];
      timing.slideTimings[timingIndex].publicPath = cardSlidePaths[index];
      slidePaths.push(cardSlidePaths[index]);
      slideFiles.push(cardSlideFiles[index]);
    }

    const suffix = `-${slotId}`;
    const reelVideoPath = bookingCatchUpAssetPublicPath(dayKey, `booking-catchup-reel${suffix}.mp4`);
    const reelVideoFile = bookingImageAbsolutePathFromPublicPath(reelVideoPath);
    if (!reelVideoFile) throw new Error("Unable to resolve Booking Catch-Up reel output path.");
    await fs.mkdir(path.dirname(reelVideoFile), { recursive: true });
    await renderVideoFromSlides({
      dayKey,
      slideFiles,
      slideDurations: timing.slideTimings.map((slide) => slide.durationSeconds),
      outputFile: reelVideoFile,
      timing,
      config,
    });

    let posterImagePath: string | null = null;
    let posterImageFile: string | null = null;
    if (config.includeStaticFallback) {
      const posterBytes = await sharp(slideFiles[0]).jpeg({ quality: 88 }).toBuffer();
      posterImagePath = await writeBookingCatchUpAssetFromBuffer(dayKey, `booking-catchup-poster${suffix}.jpg`, posterBytes);
      posterImageFile = bookingImageAbsolutePathFromPublicPath(posterImagePath) ?? null;
    }

    builds.push({
      ok: true,
      skipped: false,
      dayKey,
      timeZone: config.timeZone,
      dateLabel,
      slotTime,
      slotId,
      caption: createBookingCatchUpCaption(dayKey, options.siteUrl, { batchNumber, totalBatches, recordCount: batch.length, totalRecordCount: selectedRecords.length }),
      siteUrl: bookingCatchUpSiteUrl(options.siteUrl),
      recordCount: selected.length,
      totalRecordCount: selectedRecords.length,
      batchNumber,
      totalBatches,
      timing,
      records: selected as BookingCatchUpReelBuild["records"],
      assets: { reelVideoPath, reelVideoFile, posterImagePath, posterImageFile, slidePaths, slideFiles },
    });
  }
  return { ok: true as const, skipped: false as const, dayKey, timeZone: config.timeZone, dateLabel, totalRecordCount: records.length, reels: builds };
}

export async function buildBookingCatchUp(options: {
  dayKey?: string;
  slotTime?: string;
  siteUrl?: string;
  records?: BookingCatchUpEligibleRecord[];
  config?: BookingCatchUpConfig;
}): Promise<BookingCatchUpBuildResult> {
  const result = await buildBookingCatchUpReels(options);
  if (!result.ok) return result;
  return result.reels[0];
}

async function logPublishedBookingCatchUp(dayKey: string, build: BookingCatchUpReelBuild, message: string) {
  const batchKey = `${dayKey}:${build.slotId}:part-${build.batchNumber}-of-${build.totalBatches}`;
  const db = getDb();
  await db.$transaction([
    db.publishLog.create({
      data: { targetType: BOOKING_CATCHUP_TARGET_TYPE, targetId: batchKey, action: `${BOOKING_CATCHUP_REEL_ACTION_PREFIX}${batchKey}`, message },
    }),
    ...build.records.map((record) =>
      db.publishLog.create({
        data: { targetType: "record", targetId: record.id, action: `${BOOKING_CATCHUP_RECORD_ACTION_PREFIX}${dayKey}`, message },
      }),
    ),
  ]);
}

export async function publishBookingCatchUpBuild(
  build: BookingCatchUpReelBuild,
  publishReel: (input: { dayKey: string; caption: string; videoFile: string; posterFile?: string | null }) => Promise<{ reelId: string; permalink?: string | null }>,
) {
  try {
    const published = await publishReel({ dayKey: build.dayKey, caption: build.caption, videoFile: build.assets.reelVideoFile, posterFile: build.assets.posterImageFile });
    await logPublishedBookingCatchUp(build.dayKey, build, JSON.stringify({ reelId: published.reelId, permalink: published.permalink ?? null, asset: build.assets.reelVideoPath }));
    await markFacebookPostResult();
    return published;
  } catch (error) {
    await markFacebookPostResult(error);
    throw error;
  }
}

export async function wasBookingCatchUpAlreadyPublished(dayKey: string, batchNumber?: number, totalBatches?: number, slotId?: string) {
  const targetId = batchNumber && totalBatches && slotId ? `${dayKey}:${slotId}:part-${batchNumber}-of-${totalBatches}` : dayKey;
  const existing = await getDb().publishLog.findFirst({
    where: { targetType: BOOKING_CATCHUP_TARGET_TYPE, targetId, action: `${BOOKING_CATCHUP_REEL_ACTION_PREFIX}${targetId}` },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function getBookingCatchUpStatus(now = new Date()) {
  const config = getBookingCatchUpConfig();
  const slot = timeSlotForDay(config, now);
  const eligibleRecords = config.enabled ? await findEligiblePostedRecords(slot.dayKey, config) : [];
  return {
    enabled: config.enabled,
    autoPost: config.autoPost,
    time: config.time,
    times: config.times,
    timeZone: config.timeZone,
    format: config.format,
    dayKey: slot.dayKey,
    dueNow: slot.due,
    dueSlots: slot.dueSlots.map((dueSlot) => dueSlot.time),
    alreadyPublished: await Promise.all(config.times.map(async (time) => ({
      time,
      published: await wasBookingCatchUpAlreadyPublished(slot.dayKey, 1, 1, slotIdForTime(time)),
    }))),
    eligibleRecordCount: eligibleRecords.length,
    eligibleRecordSlugs: eligibleRecords.map((record) => record.slug),
    targetDurationSeconds: config.targetDurationSeconds,
    maxRecordsPerReel: config.maxRecordsPerReel,
    maxReelsPerDay: config.maxReelsPerDay,
  };
}

export async function runBookingCatchUpAutomation(options: {
  now?: Date;
  publishReel?: (input: { dayKey: string; caption: string; videoFile: string; posterFile?: string | null }) => Promise<{ reelId: string; permalink?: string | null }>;
} = {}) {
  const config = getBookingCatchUpConfig();
  const now = options.now ?? new Date();
  const slot = timeSlotForDay(config, now);
  if (!config.enabled) return { skipped: true, reason: "BOOKING_CATCHUP_ENABLED=false", dayKey: slot.dayKey };
  if (!config.autoPost) return { skipped: true, reason: "BOOKING_CATCHUP_AUTO_POST=false", dayKey: slot.dayKey };
  if (!slot.due) return { skipped: true, reason: "Booking Catch-Up publish time has not been reached yet.", dayKey: slot.dayKey };
  if (!options.publishReel) return { skipped: true, reason: "No Reel publish callback was provided.", dayKey: slot.dayKey };

  const posted = [];
  const builds = [];
  for (const dueSlot of slot.dueSlots) {
    const build = await buildBookingCatchUpReels({ dayKey: slot.dayKey, slotTime: dueSlot.time, config });
    builds.push(build);
    if (!build.ok) continue;
    for (const reel of build.reels) {
      if (await wasBookingCatchUpAlreadyPublished(slot.dayKey, reel.batchNumber, reel.totalBatches, reel.slotId)) continue;
      posted.push(await publishBookingCatchUpBuild(reel, options.publishReel));
    }
  }
  return { posted: posted.length > 0, dayKey: slot.dayKey, publishedCount: posted.length, builds };
}
