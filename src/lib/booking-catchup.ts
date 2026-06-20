import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import { getDb } from "./db";
import {
  bookingImageAbsolutePathFromPublicPath,
  bookingCatchUpAssetPublicPath,
  writeBookingCatchUpAssetFromBuffer,
} from "./booking-image-storage";
import { resolveBookingPhoto } from "./booking-photo";
import { markFacebookPostResult } from "./facebook-connection";
import { formatBookingDateTime } from "./display-format";

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
const BOOKING_CATCHUP_MUGSHOT_WIDTH = 1022;
const BOOKING_CATCHUP_MUGSHOT_HEIGHT = 950;

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
  postWindowMinutes: number;
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
    postWindowMinutes: envInt("BOOKING_CATCHUP_POST_WINDOW_MINUTES", 90),
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

export function timeSlotForDay(config: BookingCatchUpConfig, now: Date) {
  const parts = formatParts(now, config.timeZone);
  const currentMinutes = Number.parseInt(parts.hour || "0", 10) * 60 + Number.parseInt(parts.minute || "0", 10);
  const slots = config.times.map((time) => {
    const [scheduledHour, scheduledMinute] = time.split(":").map((value) => Number.parseInt(value, 10));
    const scheduledMinutes = scheduledHour * 60 + scheduledMinute;
    const minutesSinceScheduled = currentMinutes - scheduledMinutes;
    return {
      time,
      slotId: slotIdForTime(time),
      due: minutesSinceScheduled >= 0 && minutesSinceScheduled < config.postWindowMinutes,
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

function cleanUpper(value?: string | null, fallback = "NOT LISTED") {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.toUpperCase() : fallback;
}

function wrapWords(value: string, maxChars: number, maxLines: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  if (lines.length <= maxLines) return lines;

  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = `${kept[maxLines - 1].replace(/\s+$/, "")}...`;
  return kept;
}

function tspans(lines: string[], x: number, y: number, lineHeight: number, textLength?: number) {
  const fitAttrs = textLength ? ` textLength="${textLength}" lengthAdjust="spacingAndGlyphs"` : "";
  return lines
    .map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}"${fitAttrs}>${escapeXml(line)}</tspan>`)
    .join("");
}

function fittedFont(lines: string[], baseSize: number, minSize: number, idealChars: number) {
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return Math.max(minSize, Math.min(baseSize, Math.floor(baseSize * (idealChars / longest))));
}

function bookingCatchUpSimpleBadge(x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.48}" fill="#030304" stroke="#c51621" stroke-width="${size * 0.04}"/>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.43}" fill="#020203" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>
      <text x="${cx}" y="${cy - size * 0.17}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${size * 0.21}" font-weight="900" fill="#f4f4f4" letter-spacing="1">BIG</text>
      <text x="${cx}" y="${cy + size * 0.06}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${size * 0.18}" font-weight="900" fill="#d71924" letter-spacing="0.5">SANDY</text>
      <text x="${cx}" y="${cy + size * 0.24}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${size * 0.09}" font-weight="900" fill="#f4f4f4" letter-spacing="0.5">CRIME WATCH</text>
    </g>
  `;
}

function bookingCatchUpDefs() {
  return `
    <filter id="reelNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="23" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer><feFuncA type="table" tableValues="0 0.16"/></feComponentTransfer>
      <feBlend mode="soft-light" in2="SourceGraphic"/>
    </filter>
    <radialGradient id="reelBg" cx="50%" cy="28%" r="76%">
      <stop offset="0%" stop-color="#1a1b1f"/>
      <stop offset="56%" stop-color="#09090b"/>
      <stop offset="100%" stop-color="#010101"/>
    </radialGradient>
    <linearGradient id="catchupRed" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#8d1118"/>
      <stop offset="45%" stop-color="#e01f2b"/>
      <stop offset="100%" stop-color="#8b1017"/>
    </linearGradient>
    <linearGradient id="photoVignette" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(0,0,0,0.05)"/>
      <stop offset="72%" stop-color="rgba(0,0,0,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.22)"/>
    </linearGradient>
  `;
}

async function readBookingCatchUpPhoto(record: BookingCatchUpEligibleRecord) {
  const photo = await resolveBookingPhoto(record);
  if (photo.status !== "available" || !photo.imagePathOrUrl) return null;

  let bytes: Buffer;
  if (/^https?:\/\//i.test(photo.imagePathOrUrl)) {
    const response = await fetch(photo.imagePathOrUrl);
    if (!response.ok) return null;
    bytes = Buffer.from(await response.arrayBuffer());
  } else {
    const localPath = bookingImageAbsolutePathFromPublicPath(photo.imagePathOrUrl);
    if (!localPath) return null;
    bytes = await fs.readFile(path.resolve(localPath));
  }

  const cropped = await sharp(bytes)
    .resize(BOOKING_CATCHUP_MUGSHOT_WIDTH, BOOKING_CATCHUP_MUGSHOT_HEIGHT, {
      fit: "cover",
      position: sharp.strategy.attention,
    })
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  return {
    bytes: cropped,
    mimeType: "image/jpeg",
  };
}

function bookingCatchUpPhotoSvg(photo: Awaited<ReturnType<typeof readBookingCatchUpPhoto>>) {
  if (!photo) {
    return `
      <rect x="29" y="284" width="1022" height="950" fill="#2f333a"/>
      ${Array.from({ length: 8 })
        .map((_, index) => `<line x1="122" y1="${362 + index * 88}" x2="766" y2="${362 + index * 88}" stroke="rgba(255,255,255,0.36)" stroke-width="5"/>`)
        .join("")}
      <text x="540" y="765" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="38" fill="#f5f5f5">BOOKING PHOTO UNAVAILABLE</text>
    `;
  }

  const href = `data:${photo.mimeType};base64,${photo.bytes.toString("base64")}`;
  return `
    <image href="${href}" x="29" y="284" width="1022" height="950" preserveAspectRatio="none"/>
    <rect x="29" y="284" width="1022" height="950" fill="url(#photoVignette)"/>
    <g transform="rotate(-29 540 760)">
      <text x="540" y="760" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="66" font-weight="900" fill="rgba(255,255,255,0.065)" stroke="rgba(0,0,0,0.06)" stroke-width="1.5" letter-spacing="3">BIGSANDYCRIMEWATCH.COM</text>
    </g>
  `;
}

function bookedDateText(record: BookingCatchUpEligibleRecord) {
  return cleanUpper(
    formatBookingDateTime(record.bookingDateTimeText, false) ||
      formatBookingDateTime(record.recordDate, false),
    "DATE UNAVAILABLE",
  );
}

async function createBookingCatchUpCardSlide(record: BookingCatchUpEligibleRecord) {
  const photo = await readBookingCatchUpPhoto(record);
  const name = cleanUpper(record.displayName, "NAME UNAVAILABLE");
  const nameLines = wrapWords(name, 24, 2);
  const nameFont = fittedFont(nameLines, 88, 50, 14.5);
  const nameStartY = nameLines.length > 1 ? 1312 : 1346;
  const bookedLines = wrapWords(bookedDateText(record), 18, 2);
  const agencyLines = wrapWords(cleanUpper(record.arrestingAgency ?? record.sourceName, "NOT LISTED"), 20, 2);
  const bookedFont = fittedFont(bookedLines, 34, 25, 15);
  const agencyFont = fittedFont(agencyLines, 34, 20, 13);
  const agencyTextLength = agencyLines.some((line) => line.length > 12) ? 306 : undefined;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
      <defs>${bookingCatchUpDefs()}</defs>
      <rect width="1080" height="1920" fill="url(#reelBg)"/>
      <rect width="1080" height="1920" fill="rgba(0,0,0,0.16)" filter="url(#reelNoise)"/>
      ${bookingCatchUpSimpleBadge(34, 32, 146)}
      <text x="650" y="116" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="56" font-weight="900" fill="#f7f7f7" letter-spacing="1.2" textLength="770" lengthAdjust="spacingAndGlyphs">BIG SANDY CRIME WATCH</text>

      <polygon points="215,170 900,170 874,232 189,232" fill="url(#catchupRed)"/>
      <path d="M166 170l-28 62M188 170l-28 62M916 170l-28 62M938 170l-28 62" stroke="#d71924" stroke-width="8"/>
      <text x="544" y="213" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="34" font-weight="900" fill="#ffffff" letter-spacing="15">BOOKING CATCH-UP</text>

      <rect x="26" y="281" width="1028" height="1329" fill="#030303" stroke="#d71924" stroke-width="4"/>
      <clipPath id="mugshotClip"><rect x="29" y="284" width="1022" height="950"/></clipPath>
      <g clip-path="url(#mugshotClip)">
        ${bookingCatchUpPhotoSvg(photo)}
      </g>
      <rect x="29" y="284" width="1022" height="950" fill="none" stroke="#d71924" stroke-width="3"/>

      <rect x="29" y="1234" width="1022" height="168" fill="#040405"/>
      <text x="540" y="${nameStartY}" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${nameFont}" font-weight="900" fill="#f2f2f2" letter-spacing="2">${tspans(nameLines, 540, nameStartY, Math.round(nameFont * 0.86))}</text>
      <line x1="43" y1="1402" x2="1037" y2="1402" stroke="#d71924" stroke-width="3"/>

      <rect x="29" y="1404" width="1022" height="206" fill="#070708"/>
      <line x1="329" y1="1404" x2="329" y2="1610" stroke="rgba(215,25,36,0.72)" stroke-width="2"/>
      <line x1="679" y1="1404" x2="679" y2="1610" stroke="rgba(215,25,36,0.72)" stroke-width="2"/>
      <text x="179" y="1469" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#d71924">BOOKED:</text>
      <text x="179" y="1530" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${bookedFont}" font-weight="900" fill="#f4f4f4">${tspans(bookedLines, 179, 1530, 38)}</text>
      <text x="504" y="1469" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#d71924">AGENCY:</text>
      <text x="504" y="1530" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${agencyFont}" font-weight="900" fill="#f4f4f4">${tspans(agencyLines, 504, 1530, 36, agencyTextLength)}</text>
      <text x="865" y="1466" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="26" font-weight="900" fill="#d71924" textLength="280" lengthAdjust="spacingAndGlyphs">CHARGE DETAILS:</text>
      <text x="865" y="1536" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="22" font-weight="900" fill="#f4f4f4" letter-spacing="0.2" textLength="294" lengthAdjust="spacingAndGlyphs">BIGSANDYCRIMEWATCH.COM</text>

      <line x1="175" y1="1693" x2="905" y2="1693" stroke="rgba(215,25,36,0.72)" stroke-width="3" stroke-linecap="round"/>
      <text x="540" y="1737" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#d8d8d8" letter-spacing="1.8">ARREST DOES NOT IMPLY GUILT.</text>
      <text x="540" y="1785" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#d8d8d8" letter-spacing="1.8">ALL INDIVIDUALS ARE PRESUMED INNOCENT</text>
      <text x="540" y="1833" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#d8d8d8" letter-spacing="1.8">UNLESS PROVEN GUILTY IN COURT.</text>
    </svg>
  `;

  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
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
      const photo = await resolveBookingPhoto(record);
      const slide = await createBookingCatchUpCardSlide(record);
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
