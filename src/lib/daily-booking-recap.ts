import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { getDb } from "./db";
import { ensureBookingCardImages } from "./booking-card-generator";
import {
  bookingImageAbsolutePathFromPublicPath,
  dailyRecapAssetPublicPath,
  writeDailyRecapAssetFromBuffer,
} from "./booking-image-storage";
import { resolveBookingPhoto } from "./booking-photo";
import { markFacebookPostResult } from "./facebook-connection";

const DAILY_RECAP_TARGET_TYPE = "daily_recap";
const DAILY_RECAP_RECORD_ACTION_PREFIX = "DAILY_RECAP_INCLUDED:";
const DAILY_RECAP_REEL_ACTION_PREFIX = "DAILY_RECAP_REEL_POSTED:";
const DAILY_RECAP_URL_CAMPAIGN = "daily_booking_recap";
const AUDIO_TITLE = "Late Night Drive (Loop)";
const AUDIO_ARTIST = "Marshall Rogalski";
const AUDIO_SOURCE = "Meta Sound Collection";
const AUDIO_ASSET_ID = "462993695415494";
const FIRST_CARD_CLEAN_BEATS = 2;
const COUNTDOWN_PULSE_SECONDS = 0.16;

export type DailyRecapEligibleRecord = {
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
  facebookDraftUpdatedAt: Date;
};

export type DailyRecapConfig = {
  enabled: boolean;
  autoPost: boolean;
  time: string;
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

export type DailyRecapSlidePlan = {
  kind: "hook" | "card" | "outro";
  text: string;
  startSeconds: number;
  endSeconds: number;
  durationSeconds: number;
  beats: number;
  file?: string;
  publicPath?: string;
};

export type DailyRecapReelBuild = {
  ok: true;
  skipped: false;
  dayKey: string;
  timeZone: string;
  dateLabel: string;
  caption: string;
  siteUrl: string;
  recordCount: number;
  totalRecordCount: number;
  batchNumber: number;
  totalBatches: number;
  timing: DailyRecapTimingPlan;
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

export type DailyRecapBuildResult =
  | {
      ok: false;
      skipped: true;
      reason: string;
      dayKey: string;
      timeZone: string;
      dateLabel: string;
    }
  | DailyRecapReelBuild;

export type DailyRecapTimingPlan = {
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
  slideTimings: DailyRecapSlidePlan[];
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

export function getDailyRecapConfig(): DailyRecapConfig {
  return {
    enabled: envBool("DAILY_RECAP_ENABLED", false),
    autoPost: envBool("DAILY_RECAP_AUTO_POST", false),
    time: process.env.DAILY_RECAP_TIME || "20:00",
    timeZone: process.env.DAILY_RECAP_TIMEZONE || "America/New_York",
    format: "reel",
    maxRecords: envInt("DAILY_RECAP_MAX_RECORDS", 12),
    maxRecordsPerReel: envInt("DAILY_RECAP_MAX_RECORDS_PER_REEL", 7),
    maxReelsPerDay: envInt("DAILY_RECAP_MAX_REELS_PER_DAY", 4),
    minDurationSeconds: envNum("DAILY_RECAP_MIN_DURATION_SECONDS", 10.5),
    targetDurationSeconds: envNum("DAILY_RECAP_TARGET_DURATION_SECONDS", 15),
    includeStaticFallback: envBool("DAILY_RECAP_INCLUDE_STATIC_FALLBACK", true),
    hookBeats: envInt("DAILY_RECAP_HOOK_BEATS", 8),
    outroBeats: envInt("DAILY_RECAP_OUTRO_BEATS", 2),
    audioFile: process.env.DAILY_RECAP_AUDIO_FILE || null,
    audioTitle: process.env.DAILY_RECAP_AUDIO_TITLE || AUDIO_TITLE,
    audioArtist: process.env.DAILY_RECAP_AUDIO_ARTIST || AUDIO_ARTIST,
    audioSource: process.env.DAILY_RECAP_AUDIO_SOURCE || AUDIO_SOURCE,
    audioAssetId: process.env.DAILY_RECAP_AUDIO_ASSET_ID || AUDIO_ASSET_ID,
    audioVolume: envNum("DAILY_RECAP_AUDIO_VOLUME", 0.3),
    audioFadeSeconds: envNum("DAILY_RECAP_AUDIO_FADE_SECONDS", 0.35),
    audioBpm: envNum("DAILY_RECAP_AUDIO_BPM", 129.310345),
    audioBeatOffsetSeconds: Number.parseFloat(process.env.DAILY_RECAP_AUDIO_BEAT_OFFSET_SECONDS || "0") || 0,
    includeAudioAttributionInCaption: envBool("DAILY_RECAP_INCLUDE_AUDIO_ATTRIBUTION_IN_CAPTION", false),
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

function recapSiteUrl(site = process.env.SITE_URL || "https://bigsandycrimewatch.com") {
  const url = new URL("/today", `${site.replace(/\/$/, "")}/`);
  url.search = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: DAILY_RECAP_URL_CAMPAIGN,
    utm_content: "reel",
  }).toString();
  return url.toString();
}

export function createDailyBookingRecapCaption(dayKey: string, site?: string, part?: { batchNumber: number; totalBatches: number; recordCount: number; totalRecordCount: number }) {
  const config = getDailyRecapConfig();
  const dateLabel = dateLabelForDayKey(dayKey, config.timeZone);
  const partLine = part && part.totalBatches > 1
    ? `Part ${part.batchNumber} of ${part.totalBatches}: ${part.recordCount} of ${part.totalRecordCount} booking records.`
    : part
      ? `${part.recordCount} booking record${part.recordCount === 1 ? "" : "s"} in this recap.`
      : "Daily Booking Recap";
  return [
    `DAILY BOOKING RECAP - ${dateLabel}`,
    "",
    partLine,
    "",
    "View full records:",
    recapSiteUrl(site),
    "",
    "An arrest does not imply guilt. All individuals are presumed innocent unless proven guilty in court.",
    config.includeAudioAttributionInCaption ? `Music: ${config.audioTitle} - ${config.audioArtist} / ${config.audioSource}` : "",
  ].filter((line, index, lines) => line || lines[index - 1] !== "").join("\n");
}

function timeSlotForDay(config: DailyRecapConfig, now: Date) {
  const parts = formatParts(now, config.timeZone);
  const [scheduledHour, scheduledMinute] = config.time.split(":").map((value) => Number.parseInt(value, 10));
  const currentMinutes = Number.parseInt(parts.hour || "0", 10) * 60 + Number.parseInt(parts.minute || "0", 10);
  const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
  return {
    dayKey: `${parts.year}-${parts.month}-${parts.day}`,
    due: currentMinutes >= scheduledMinutes,
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

async function createRecapCardSlide(cardPublicPath: string, title: string) {
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
            <text x="540" y="228" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="30" fill="#ffffff" letter-spacing="4">DAILY BOOKING RECAP</text>
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

async function createCountdownOverlaySlide(baseSlideFile: string, text: string, variant: "settled" | "pulse" = "settled") {
  const isNumber = /^[123]$/.test(text);
  const numberSize = variant === "pulse" ? 318 : 286;
  const numberOpacity = variant === "pulse" ? 0.98 : 0.9;
  const accentOpacity = variant === "pulse" ? 0.92 : 0.68;
  const overlayText = text === "DAILY RECAP STARTING IN"
    ? [
        '<text x="540" y="842" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="92" fill="#ffffff" letter-spacing="1">DAILY RECAP</text>',
        '<text x="540" y="938" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="52" fill="#ffffff" letter-spacing="5">STARTING IN</text>',
      ].join("")
    : `<text x="540" y="936" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="${numberSize}" fill="#ffffff" opacity="${numberOpacity}">${escapeXml(text)}</text>`;

  return sharp(baseSlideFile)
    .composite([
      {
        input: Buffer.from(
          `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
            <rect width="1080" height="1920" fill="rgba(2,6,12,0.22)"/>
            <rect x="${isNumber ? 250 : 168}" y="${isNumber ? 704 : 724}" width="${isNumber ? 580 : 744}" height="${isNumber ? 290 : 270}" rx="34" fill="rgba(3,7,13,0.48)"/>
            <path d="M${isNumber ? 396 : 302} ${isNumber ? 754 : 778} H${isNumber ? 684 : 778}" stroke="#d51f2a" stroke-width="${isNumber ? 7 : 8}" stroke-linecap="round" opacity="${accentOpacity}"/>
            <g filter="url(#textShadow)">
              ${overlayText}
            </g>
            <defs>
              <filter id="textShadow" x="-24%" y="-24%" width="148%" height="148%">
                <feDropShadow dx="0" dy="9" stdDeviation="8" flood-color="#000000" flood-opacity="0.78"/>
                <feDropShadow dx="0" dy="0" stdDeviation="${isNumber ? 5 : 3}" flood-color="#b71723" flood-opacity="${isNumber ? 0.52 : 0.2}"/>
              </filter>
            </defs>
          </svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

async function createOutroSlide(baseSlideFile: string) {
  return sharp(baseSlideFile)
    .composite([
      {
        input: Buffer.from(
          `<svg width="1080" height="1920" xmlns="http://www.w3.org/2000/svg">
            <rect width="1080" height="1920" fill="rgba(2,6,12,0.64)"/>
            <rect x="155" y="760" width="770" height="300" rx="16" fill="rgba(3,7,13,0.56)" stroke="rgba(255,255,255,0.24)" stroke-width="2"/>
            <text x="540" y="875" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="72" fill="#ffffff">FULL DETAILS</text>
            <text x="540" y="970" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="72" fill="#ffffff">POSTED NOW</text>
            <text x="540" y="1040" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="34" fill="#ffffff">BigSandyCrimeWatch.com</text>
          </svg>`,
        ),
        top: 0,
        left: 0,
      },
    ])
    .png()
    .toBuffer();
}

function bookingTimeText(record: Pick<DailyRecapEligibleRecord, "bookingDateTimeText" | "recordDate" | "bookingTimeKnown">) {
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

async function findEligiblePostedRecords(dayKey: string, config: DailyRecapConfig) {
  const db = getDb();
  const recentDrafts = await db.facebookDraft.findMany({
    where: { status: "POSTED", recordId: { not: null }, updatedAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 72) } },
    orderBy: { updatedAt: "desc" },
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
          publishStatus: true,
        },
      },
    },
  });

  const alreadyIncluded = new Set((await db.publishLog.findMany({
    where: { targetType: "record", action: `${DAILY_RECAP_RECORD_ACTION_PREFIX}${dayKey}` },
    select: { targetId: true },
  })).map((entry) => entry.targetId));

  const deduped = new Map<string, DailyRecapEligibleRecord>();
  for (const draft of recentDrafts) {
    if (!draft.record || draft.record.publishStatus !== "PUBLISHED") continue;
    if (dayKeyInTimeZone(draft.updatedAt, config.timeZone) !== dayKey) continue;
    if (alreadyIncluded.has(draft.record.id) || deduped.has(draft.record.id)) continue;
    const photo = await resolveBookingPhoto(draft.record);
    if (photo.status !== "available" && photo.status !== "unavailable") continue;
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
      facebookDraftUpdatedAt: draft.updatedAt,
    });
  }
  return [...deduped.values()].sort((a, b) => a.facebookDraftUpdatedAt.getTime() - b.facebookDraftUpdatedAt.getTime()).slice(0, config.maxRecords);
}

export function splitDailyRecapRecords(records: DailyRecapEligibleRecord[], config = getDailyRecapConfig()) {
  const maxPerReel = Math.max(1, config.maxRecordsPerReel);
  const maxReels = Math.max(1, config.maxReelsPerDay);
  const maxRecords = maxPerReel * maxReels;
  const selected = records.slice(0, maxRecords);
  const reelCount = Math.ceil(selected.length / maxPerReel);
  if (reelCount <= 1) return selected.length ? [selected] : [];
  const base = Math.floor(selected.length / reelCount);
  let extra = selected.length % reelCount;
  const batches: DailyRecapEligibleRecord[][] = [];
  let index = 0;
  for (let batch = 0; batch < reelCount; batch += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    extra -= 1;
    batches.push(selected.slice(index, index + size));
    index += size;
  }
  return batches;
}

function cardBeatsForSize(size: number) {
  if (size <= 1) return 12;
  if (size === 2) return 7;
  if (size <= 4) return 5;
  if (size <= 6) return 4;
  return 3;
}

export function planDailyRecapTiming(batchSize: number, config = getDailyRecapConfig()): DailyRecapTimingPlan {
  const beatIntervalSeconds = Number((60 / config.audioBpm).toFixed(6));
  const cardBeatsPerRecord = cardBeatsForSize(batchSize);
  const hookBeats = Math.max(8, config.hookBeats);
  const outroBeats = config.outroBeats;
  const cardBeats = Array.from({ length: batchSize }, (_, index) => index === 0 ? FIRST_CARD_CLEAN_BEATS : cardBeatsPerRecord);
  let totalBeats = hookBeats + cardBeats.reduce((sum, beats) => sum + beats, 0) + outroBeats;
  while (totalBeats * beatIntervalSeconds < config.minDurationSeconds) {
    totalBeats += 1;
    if (cardBeats.length > 1) cardBeats[cardBeats.length - 1] += 1;
    else if (cardBeats.length === 1) cardBeats[0] += 1;
  }

  const slideTimings: DailyRecapSlidePlan[] = [];
  let cursor = 0;
  const push = (kind: DailyRecapSlidePlan["kind"], text: string, beats: number) => {
    const durationSeconds = Number((beats * beatIntervalSeconds).toFixed(3));
    const startSeconds = Number(cursor.toFixed(3));
    cursor += durationSeconds;
    slideTimings.push({ kind, text, beats, startSeconds, endSeconds: Number(cursor.toFixed(3)), durationSeconds });
  };

  push("hook", "DAILY RECAP STARTING IN", 2);
  push("hook", "3", 2);
  push("hook", "2", 2);
  push("hook", "1", hookBeats - 6);
  for (let index = 0; index < batchSize; index += 1) {
    push("card", `BOOKING CARD ${index + 1} OF ${batchSize}`, cardBeats[index] ?? cardBeatsPerRecord);
  }
  push("outro", "FULL DETAILS POSTED NOW / BIGSANDYCRIMEWATCH.COM", outroBeats);

  return {
    bpm: config.audioBpm,
    beatIntervalSeconds,
    beatOffsetSeconds: config.audioBeatOffsetSeconds,
    hookBeats,
    cardBeatsPerRecord,
    outroBeats,
    hookDurationSeconds: Number((hookBeats * beatIntervalSeconds).toFixed(3)),
    cardDurationSeconds: Number((cardBeatsPerRecord * beatIntervalSeconds).toFixed(3)),
    outroDurationSeconds: Number((outroBeats * beatIntervalSeconds).toFixed(3)),
    totalDurationSeconds: Number(cursor.toFixed(3)),
    batchSize,
    slideTimings,
  };
}

async function readableAudio(config: DailyRecapConfig) {
  if (!config.audioFile) return null;
  try {
    const stat = await fs.stat(config.audioFile);
    return stat.isFile() && stat.size > 0 ? config.audioFile : null;
  } catch {
    return null;
  }
}

function audioArgs(config: DailyRecapConfig, audioFile: string | null, totalDurationSeconds: number) {
  if (!audioFile) {
    return {
      args: ["-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=44100"],
      filterArgs: [] as string[],
      audioMapped: false,
    };
  }
  const fade = Math.min(config.audioFadeSeconds, totalDurationSeconds / 2);
  return {
    args: ["-stream_loop", "-1", "-i", audioFile],
    filterArgs: [
      "-filter:a",
      `volume=${config.audioVolume},afade=t=in:st=0:d=${fade}`,
    ],
    audioMapped: true,
  };
}

async function renderVideoFromSlides(input: {
  dayKey: string;
  slideFiles: string[];
  slideDurations: number[];
  outputFile: string;
  timing: DailyRecapTimingPlan;
  config: DailyRecapConfig;
}) {
  const concatFile = path.join(os.tmpdir(), `bscw-daily-recap-${input.dayKey}-${Date.now()}.txt`);
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

export async function buildDailyBookingRecapReels(options: {
  dayKey?: string;
  siteUrl?: string;
  records?: DailyRecapEligibleRecord[];
  config?: DailyRecapConfig;
}) {
  const config = options.config ?? getDailyRecapConfig();
  const dayKey = options.dayKey ?? dayKeyInTimeZone(new Date(), config.timeZone);
  const dateLabel = dateLabelForDayKey(dayKey, config.timeZone);
  const records = options.records ?? (await findEligiblePostedRecords(dayKey, config));
  const batches = splitDailyRecapRecords(records, config);
  if (batches.length === 0) {
    return { ok: false as const, skipped: true as const, reason: "No Facebook-posted booking records were eligible for this recap day.", dayKey, timeZone: config.timeZone, dateLabel };
  }

  const builds: DailyRecapReelBuild[] = [];
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
    const batch = batches[batchIndex];
    const batchNumber = batchIndex + 1;
    const totalBatches = batches.length;
    const timing = planDailyRecapTiming(batch.length, config);
    const slideFiles: string[] = [];
    const slidePaths: string[] = [];
    const videoSlideFiles: string[] = [];
    const videoSlideDurations: number[] = [];
    const selected = [];
    const firstCards = await ensureBookingCardImages(batch[0]);
    const cardSlideFiles: string[] = [];
    const cardSlidePaths: string[] = [];

    for (let index = 0; index < batch.length; index += 1) {
      const record = batch[index];
      const cards = index === 0 ? firstCards : await ensureBookingCardImages(record);
      const photo = await resolveBookingPhoto(record);
      const slide = await createRecapCardSlide(cards.fullPath, record.displayName);
      const slideName = `part-${batchNumber}-card-${String(index + 1).padStart(2, "0")}.png`;
      const slidePath = await writeDailyRecapAssetFromBuffer(dayKey, slideName, slide);
      const slideFile = bookingImageAbsolutePathFromPublicPath(slidePath);
      if (!slideFile) throw new Error(`Unable to resolve slide file for ${slidePath}`);
      cardSlidePaths.push(slidePath);
      cardSlideFiles.push(slideFile);
      selected.push({ id: record.id, slug: record.slug, displayName: record.displayName, photoStatus: photo.status, bookingTimeText: bookingTimeText(record) });
    }

    for (let index = 0; index < 4; index += 1) {
      const timingSlide = timing.slideTimings[index];
      const slide = await createCountdownOverlaySlide(cardSlideFiles[0], timingSlide.text);
      const slideName = `part-${batchNumber}-countdown-${String(index + 1).padStart(2, "0")}.png`;
      const slidePath = await writeDailyRecapAssetFromBuffer(dayKey, slideName, slide);
      const slideFile = bookingImageAbsolutePathFromPublicPath(slidePath);
      if (!slideFile) throw new Error(`Unable to resolve slide file for ${slidePath}`);
      timingSlide.file = slideFile;
      timingSlide.publicPath = slidePath;
      slidePaths.push(slidePath);
      slideFiles.push(slideFile);
      if (/^[123]$/.test(timingSlide.text)) {
        const pulseSlide = await createCountdownOverlaySlide(cardSlideFiles[0], timingSlide.text, "pulse");
        const pulseName = `part-${batchNumber}-countdown-${String(index + 1).padStart(2, "0")}-pulse.png`;
        const pulsePath = await writeDailyRecapAssetFromBuffer(dayKey, pulseName, pulseSlide);
        const pulseFile = bookingImageAbsolutePathFromPublicPath(pulsePath);
        if (!pulseFile) throw new Error(`Unable to resolve slide file for ${pulsePath}`);
        videoSlideFiles.push(pulseFile, slideFile);
        videoSlideDurations.push(COUNTDOWN_PULSE_SECONDS, Number((timingSlide.durationSeconds - COUNTDOWN_PULSE_SECONDS).toFixed(3)));
      } else {
        videoSlideFiles.push(slideFile);
        videoSlideDurations.push(timingSlide.durationSeconds);
      }
    }

    for (let index = 0; index < cardSlideFiles.length; index += 1) {
      const timingIndex = 4 + index;
      timing.slideTimings[timingIndex].text = `${batch[index].displayName} / ${index + 1} OF ${batch.length}`;
      timing.slideTimings[timingIndex].file = cardSlideFiles[index];
      timing.slideTimings[timingIndex].publicPath = cardSlidePaths[index];
      slidePaths.push(cardSlidePaths[index]);
      slideFiles.push(cardSlideFiles[index]);
      videoSlideFiles.push(cardSlideFiles[index]);
      videoSlideDurations.push(timing.slideTimings[timingIndex].durationSeconds);
    }

    const outro = await createOutroSlide(cardSlideFiles.at(-1) ?? cardSlideFiles[0]);
    const outroName = `part-${batchNumber}-outro.png`;
    const outroPath = await writeDailyRecapAssetFromBuffer(dayKey, outroName, outro);
    const outroFile = bookingImageAbsolutePathFromPublicPath(outroPath);
    if (!outroFile) throw new Error(`Unable to resolve slide file for ${outroPath}`);
    timing.slideTimings[timing.slideTimings.length - 1].file = outroFile;
    timing.slideTimings[timing.slideTimings.length - 1].publicPath = outroPath;
    slidePaths.push(outroPath);
    slideFiles.push(outroFile);
    videoSlideFiles.push(outroFile);
    videoSlideDurations.push(timing.slideTimings[timing.slideTimings.length - 1].durationSeconds);

    const suffix = totalBatches > 1 ? `-part-${batchNumber}` : "";
    const reelVideoPath = dailyRecapAssetPublicPath(dayKey, `daily-booking-recap-reel${suffix}.mp4`);
    const reelVideoFile = bookingImageAbsolutePathFromPublicPath(reelVideoPath);
    if (!reelVideoFile) throw new Error("Unable to resolve Daily Recap reel output path.");
    await fs.mkdir(path.dirname(reelVideoFile), { recursive: true });
    await renderVideoFromSlides({
      dayKey,
      slideFiles: videoSlideFiles,
      slideDurations: videoSlideDurations,
      outputFile: reelVideoFile,
      timing,
      config,
    });

    let posterImagePath: string | null = null;
    let posterImageFile: string | null = null;
    if (config.includeStaticFallback) {
      const posterBytes = await sharp(slideFiles[0]).jpeg({ quality: 88 }).toBuffer();
      posterImagePath = await writeDailyRecapAssetFromBuffer(dayKey, `daily-booking-recap-poster${suffix}.jpg`, posterBytes);
      posterImageFile = bookingImageAbsolutePathFromPublicPath(posterImagePath) ?? null;
    }

    builds.push({
      ok: true,
      skipped: false,
      dayKey,
      timeZone: config.timeZone,
      dateLabel,
      caption: createDailyBookingRecapCaption(dayKey, options.siteUrl, { batchNumber, totalBatches, recordCount: batch.length, totalRecordCount: records.length }),
      siteUrl: recapSiteUrl(options.siteUrl),
      recordCount: selected.length,
      totalRecordCount: records.length,
      batchNumber,
      totalBatches,
      timing,
      records: selected as DailyRecapReelBuild["records"],
      assets: { reelVideoPath, reelVideoFile, posterImagePath, posterImageFile, slidePaths, slideFiles },
    });
  }
  return { ok: true as const, skipped: false as const, dayKey, timeZone: config.timeZone, dateLabel, totalRecordCount: records.length, reels: builds };
}

export async function buildDailyBookingRecap(options: {
  dayKey?: string;
  siteUrl?: string;
  records?: DailyRecapEligibleRecord[];
  config?: DailyRecapConfig;
}): Promise<DailyRecapBuildResult> {
  const result = await buildDailyBookingRecapReels(options);
  if (!result.ok) return result;
  return result.reels[0];
}

async function logPublishedRecap(dayKey: string, build: DailyRecapReelBuild, message: string) {
  const batchKey = `${dayKey}:part-${build.batchNumber}-of-${build.totalBatches}`;
  const db = getDb();
  await db.$transaction([
    db.publishLog.create({
      data: { targetType: DAILY_RECAP_TARGET_TYPE, targetId: batchKey, action: `${DAILY_RECAP_REEL_ACTION_PREFIX}${batchKey}`, message },
    }),
    ...build.records.map((record) =>
      db.publishLog.create({
        data: { targetType: "record", targetId: record.id, action: `${DAILY_RECAP_RECORD_ACTION_PREFIX}${dayKey}`, message },
      }),
    ),
  ]);
}

export async function publishDailyBookingRecapBuild(
  build: DailyRecapReelBuild,
  publishReel: (input: { dayKey: string; caption: string; videoFile: string; posterFile?: string | null }) => Promise<{ reelId: string; permalink?: string | null }>,
) {
  try {
    const published = await publishReel({ dayKey: build.dayKey, caption: build.caption, videoFile: build.assets.reelVideoFile, posterFile: build.assets.posterImageFile });
    await logPublishedRecap(build.dayKey, build, JSON.stringify({ reelId: published.reelId, permalink: published.permalink ?? null, asset: build.assets.reelVideoPath }));
    await markFacebookPostResult();
    return published;
  } catch (error) {
    await markFacebookPostResult(error);
    throw error;
  }
}

export async function wasDailyRecapAlreadyPublished(dayKey: string, batchNumber?: number, totalBatches?: number) {
  const targetId = batchNumber && totalBatches ? `${dayKey}:part-${batchNumber}-of-${totalBatches}` : dayKey;
  const existing = await getDb().publishLog.findFirst({
    where: { targetType: DAILY_RECAP_TARGET_TYPE, targetId, action: `${DAILY_RECAP_REEL_ACTION_PREFIX}${targetId}` },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function getDailyRecapStatus(now = new Date()) {
  const config = getDailyRecapConfig();
  const slot = timeSlotForDay(config, now);
  const eligibleRecords = config.enabled ? await findEligiblePostedRecords(slot.dayKey, config) : [];
  return {
    enabled: config.enabled,
    autoPost: config.autoPost,
    time: config.time,
    timeZone: config.timeZone,
    format: config.format,
    dayKey: slot.dayKey,
    dueNow: slot.due,
    alreadyPublished: await wasDailyRecapAlreadyPublished(slot.dayKey),
    eligibleRecordCount: eligibleRecords.length,
    eligibleRecordSlugs: eligibleRecords.map((record) => record.slug),
    targetDurationSeconds: config.targetDurationSeconds,
    maxRecordsPerReel: config.maxRecordsPerReel,
    maxReelsPerDay: config.maxReelsPerDay,
  };
}

export async function runDailyBookingRecapAutomation(options: {
  now?: Date;
  publishReel?: (input: { dayKey: string; caption: string; videoFile: string; posterFile?: string | null }) => Promise<{ reelId: string; permalink?: string | null }>;
} = {}) {
  const config = getDailyRecapConfig();
  const now = options.now ?? new Date();
  const slot = timeSlotForDay(config, now);
  if (!config.enabled) return { skipped: true, reason: "DAILY_RECAP_ENABLED=false", dayKey: slot.dayKey };
  if (!config.autoPost) return { skipped: true, reason: "DAILY_RECAP_AUTO_POST=false", dayKey: slot.dayKey };
  if (!slot.due) return { skipped: true, reason: "Daily recap publish time has not been reached yet.", dayKey: slot.dayKey };
  if (!options.publishReel) return { skipped: true, reason: "No Reel publish callback was provided.", dayKey: slot.dayKey };

  const build = await buildDailyBookingRecapReels({ dayKey: slot.dayKey, config });
  if (!build.ok) return build;
  const posted = [];
  for (const reel of build.reels) {
    if (await wasDailyRecapAlreadyPublished(slot.dayKey, reel.batchNumber, reel.totalBatches)) continue;
    posted.push(await publishDailyBookingRecapBuild(reel, options.publishReel));
  }
  return { posted: posted.length > 0, dayKey: slot.dayKey, publishedCount: posted.length, build };
}
