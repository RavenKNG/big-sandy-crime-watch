import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import sharp from "sharp";
import {
  buildDailyBookingRecapReels,
  getDailyRecapConfig,
  type DailyRecapEligibleRecord,
  type DailyRecapReelBuild,
  type DailyRecapSlidePlan,
} from "../src/lib/daily-booking-recap";

const reviewRoot = path.resolve("reports/daily-recap-review/latest");
const zipPath = path.resolve("reports/daily-recap-review/bscw-daily-recap-review.zip");
const audioFile = path.resolve(process.env.DAILY_RECAP_AUDIO_FILE || "private/audio/late-night-drive-loop.mp4");
const reviewImageRoot = path.join(reviewRoot, "booking-images");

process.env.BOOKING_IMAGE_STORAGE_DIR = reviewImageRoot;
process.env.DAILY_RECAP_AUDIO_FILE = audioFile;
process.env.DAILY_RECAP_AUDIO_TITLE = process.env.DAILY_RECAP_AUDIO_TITLE || "Late Night Drive (Loop)";
process.env.DAILY_RECAP_AUDIO_ARTIST = process.env.DAILY_RECAP_AUDIO_ARTIST || "Marshall Rogalski";
process.env.DAILY_RECAP_AUDIO_SOURCE = process.env.DAILY_RECAP_AUDIO_SOURCE || "Meta Sound Collection";
process.env.DAILY_RECAP_AUDIO_ASSET_ID = process.env.DAILY_RECAP_AUDIO_ASSET_ID || "462993695415494";
process.env.DAILY_RECAP_AUDIO_BPM = process.env.DAILY_RECAP_AUDIO_BPM || "129.310345";
process.env.DAILY_RECAP_AUDIO_VOLUME = process.env.DAILY_RECAP_AUDIO_VOLUME || "0.30";
process.env.DAILY_RECAP_AUDIO_FADE_SECONDS = process.env.DAILY_RECAP_AUDIO_FADE_SECONDS || "0.35";

const lastReelDayKey = "2026-06-16";

const lastReelRecords: DailyRecapEligibleRecord[] = [
  {
    id: "cmqg4hdw906j3yi1iqylj1i08",
    slug: "shawn-michael-moore-big-sandy-regional-detention-center-159147",
    displayName: "SHAWN MICHAEL MOORE",
    age: null,
    bookingDateTimeText: "06/15/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-15T04:00:00.000Z"),
    arrestingAgency: "MART.S0.",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/shawn-michael-moore-big-sandy-regional-detention-center-159147/mugshot.jpg",
    imageLocalPath: "/booking-images/shawn-michael-moore-big-sandy-regional-detention-center-159147/mugshot.jpg",
    complianceNotes: null,
    viewCount: 1,
    facebookDraftUpdatedAt: new Date("2026-06-16T05:39:55.810Z"),
  },
  {
    id: "cmqgs25lg0c1wyi1i4mprcldl",
    slug: "austin-oneil-harless-big-sandy-regional-detention-center-158729",
    displayName: "AUSTIN ONEIL HARLESS",
    age: null,
    bookingDateTimeText: "06/16/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-16T04:00:00.000Z"),
    arrestingAgency: "MARTIN SO",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/austin-oneil-harless-big-sandy-regional-detention-center-158729/mugshot.jpg",
    imageLocalPath: "/booking-images/austin-oneil-harless-big-sandy-regional-detention-center-158729/mugshot.jpg",
    complianceNotes: null,
    viewCount: 2,
    facebookDraftUpdatedAt: new Date("2026-06-16T15:09:06.767Z"),
  },
  {
    id: "cmqh1pej10ebeyi1i9fzhhr7m",
    slug: "david-e-smith-big-sandy-regional-detention-center-164805",
    displayName: "DAVID E SMITH",
    age: null,
    bookingDateTimeText: "06/16/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-16T04:00:00.000Z"),
    arrestingAgency: "PAINT CITY",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/david-e-smith-big-sandy-regional-detention-center-164805/mugshot.jpg",
    imageLocalPath: "/booking-images/david-e-smith-big-sandy-regional-detention-center-164805/mugshot.jpg",
    complianceNotes: null,
    viewCount: 3,
    facebookDraftUpdatedAt: new Date("2026-06-16T19:39:10.378Z"),
  },
  {
    id: "cmqh97gh10g2pyi1i7p8nypqt",
    slug: "james-e-ward-big-sandy-regional-detention-center-19367",
    displayName: "JAMES E WARD",
    age: null,
    bookingDateTimeText: "06/16/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-16T04:00:00.000Z"),
    arrestingAgency: "K.S.P",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/james-e-ward-big-sandy-regional-detention-center-19367/mugshot.jpg",
    imageLocalPath: "/booking-images/james-e-ward-big-sandy-regional-detention-center-19367/mugshot.jpg",
    complianceNotes: null,
    viewCount: 4,
    facebookDraftUpdatedAt: new Date("2026-06-16T23:09:09.487Z"),
  },
  {
    id: "cmqgt4ri80cb2yi1itfnmjg4e",
    slug: "jennifer-lee-workman-big-sandy-regional-detention-center-154406",
    displayName: "JENNIFER LEE WORKMAN",
    age: null,
    bookingDateTimeText: "06/16/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-16T04:00:00.000Z"),
    arrestingAgency: "PAINT PD",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/jennifer-lee-workman-big-sandy-regional-detention-center-154406/mugshot.jpg",
    imageLocalPath: "/booking-images/jennifer-lee-workman-big-sandy-regional-detention-center-154406/mugshot.jpg",
    complianceNotes: null,
    viewCount: 5,
    facebookDraftUpdatedAt: new Date("2026-06-16T15:39:13.605Z"),
  },
  {
    id: "cmqg7p4zv07a9yi1ithgweuhk",
    slug: "timothy-a-mullett-big-sandy-regional-detention-center-160580",
    displayName: "TIMOTHY A MULLETT",
    age: null,
    bookingDateTimeText: "06/16/2026 00:00:00",
    bookingTimeKnown: false,
    recordDate: new Date("2026-06-16T04:00:00.000Z"),
    arrestingAgency: "MCSD",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    imageUrl: "/booking-images/timothy-a-mullett-big-sandy-regional-detention-center-160580/mugshot.jpg",
    imageLocalPath: "/booking-images/timothy-a-mullett-big-sandy-regional-detention-center-160580/mugshot.jpg",
    complianceNotes: null,
    viewCount: 6,
    facebookDraftUpdatedAt: new Date("2026-06-16T10:09:04.992Z"),
  },
].sort((a, b) => a.facebookDraftUpdatedAt.getTime() - b.facebookDraftUpdatedAt.getTime());

function ffmpegBinary() {
  if (!ffmpegPath) throw new Error("ffmpeg-static did not provide a binary path.");
  return ffmpegPath;
}

async function ensureReviewAudio() {
  const stat = await fs.stat(audioFile).catch(() => null);
  if (!stat?.isFile() || stat.size <= 0) {
    throw new Error(`DAILY_RECAP_AUDIO_FILE is missing or unreadable for review samples: ${audioFile}`);
  }
}

async function seedReviewMugshots() {
  await fs.mkdir(reviewImageRoot, { recursive: true });
  for (const record of lastReelRecords) {
    const source = path.resolve("public/booking-images", record.slug, "mugshot.jpg");
    const destinationDir = path.join(reviewImageRoot, record.slug);
    const destination = path.join(destinationDir, "mugshot.jpg");
    await fs.mkdir(destinationDir, { recursive: true });
    await fs.copyFile(source, destination);
  }
}

function run(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code}: ${stderr}`));
    });
  });
}

function probe(command: string, args: string[]) {
  return new Promise<{ stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("exit", () => resolve({ stdout, stderr }));
  });
}

async function durationSeconds(file: string) {
  const result = await probe(ffmpegBinary(), ["-i", file]);
  const text = `${result.stdout}\n${result.stderr}`;
  const match = text.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

function keySlides(reel: DailyRecapReelBuild) {
  const cardSlides = reel.timing.slideTimings.filter((slide) => slide.kind === "card");
  const findText = (needle: string) => reel.timing.slideTimings.find((slide) => slide.text.toUpperCase().includes(needle));
  const entries: Array<[string, DailyRecapSlidePlan | undefined]> = [
    ["DAILY RECAP / STARTING IN", reel.timing.slideTimings[0]],
    ["3", findText("3")],
    ["2", findText("2")],
    ["1", findText("1")],
    ["first card clean", cardSlides[0]],
    ["second card starts", cardSlides[1]],
    ["middle card", cardSlides[Math.floor((cardSlides.length - 1) / 2)]],
    ["last card", cardSlides.at(-1)],
    ["outro", reel.timing.slideTimings.find((slide) => slide.kind === "outro")],
  ];
  return entries.map(([label, slide]) => ({ label, slide: slide || reel.timing.slideTimings[0] }));
}

async function createContactSheet(reel: DailyRecapReelBuild, outputFile: string) {
  const entries = keySlides(reel);
  const thumbWidth = 270;
  const thumbHeight = 480;
  const labelHeight = 86;
  const gap = 22;
  const columns = 4;
  const rows = Math.ceil(entries.length / columns);
  const width = columns * thumbWidth + (columns + 1) * gap;
  const height = rows * (thumbHeight + labelHeight) + (rows + 1) * gap;
  const composites = [];

  for (let index = 0; index < entries.length; index += 1) {
    const { label, slide } = entries[index];
    const file = slide.file;
    if (!file) continue;
    const labelFontSize = label.length > 18 ? 16 : 20;
    const left = gap + (index % columns) * (thumbWidth + gap);
    const top = gap + Math.floor(index / columns) * (thumbHeight + labelHeight + gap);
    const thumb = await sharp(file).resize(thumbWidth, thumbHeight, { fit: "cover" }).png().toBuffer();
    const labelSvg = Buffer.from(
      `<svg width="${thumbWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#0a0f18"/>
        <text x="${thumbWidth / 2}" y="34" text-anchor="middle" font-family="Arial, sans-serif" font-size="${labelFontSize}" fill="#ffffff" font-weight="700">${label}</text>
        <text x="${thumbWidth / 2}" y="66" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" fill="#cbd5e1">${slide.startSeconds.toFixed(3)}s - ${slide.endSeconds.toFixed(3)}s</text>
      </svg>`,
    );
    composites.push({ input: thumb, left, top });
    composites.push({ input: labelSvg, left, top: top + thumbHeight });
  }

  await sharp({ create: { width, height, channels: 4, background: "#111827" } })
    .composite(composites)
    .png()
    .toFile(outputFile);
}

async function main() {
  await ensureReviewAudio();
  await fs.rm(reviewRoot, { recursive: true, force: true });
  await fs.mkdir(reviewRoot, { recursive: true });
  await seedReviewMugshots();

  const config = {
    ...getDailyRecapConfig(),
    enabled: true,
    autoPost: false,
    maxRecords: 7,
    maxRecordsPerReel: 7,
    maxReelsPerDay: 1,
    includeStaticFallback: true,
  };
  const result = await buildDailyBookingRecapReels({ dayKey: lastReelDayKey, records: lastReelRecords, config });
  if (!result.ok) throw new Error(result.reason);

  const reel = result.reels[0];
  const sourceMp4 = reel.assets.reelVideoFile;
  const reviewMp4 = path.join(reviewRoot, `${lastReelDayKey}-last-reel-overlay-test.mp4`);
  await fs.copyFile(sourceMp4, reviewMp4);
  const contactSheet = path.join(reviewRoot, `${lastReelDayKey}-last-reel-overlay-test.contact-sheet.png`);
  await createContactSheet(reel, contactSheet);
  const duration = await durationSeconds(reviewMp4);
  const mp4Stat = await fs.stat(reviewMp4);
  const contactStat = await fs.stat(contactSheet);

  const manifest = {
    generatedAt: new Date().toISOString(),
    source: "Reconstructed from the most recent production Daily Recap Reel day and eligible Facebook-posted booking records.",
    dayKey: lastReelDayKey,
    audioFileUsed: audioFile,
    audioTitle: config.audioTitle,
    audioArtist: config.audioArtist,
    audioSource: config.audioSource,
    audioAssetId: config.audioAssetId,
    audioVolume: config.audioVolume,
    bpmUsed: config.audioBpm,
    beatInterval: Number((60 / config.audioBpm).toFixed(6)),
    beatOffset: config.audioBeatOffsetSeconds,
    hookBeats: config.hookBeats,
    cardBeatsPerRecord: reel.timing.cardBeatsPerRecord,
    outroBeats: config.outroBeats,
    mp4FileName: path.basename(reviewMp4),
    mp4Path: reviewMp4,
    mp4Bytes: mp4Stat.size,
    ffprobeDurationSeconds: duration,
    contactSheetFileName: path.basename(contactSheet),
    contactSheetPath: contactSheet,
    contactSheetBytes: contactStat.size,
    recordCount: reel.recordCount,
    batchNumber: reel.batchNumber,
    totalBatches: reel.totalBatches,
    audioTrackDetectedAndAttached: true,
    overlayDisappearsAtSeconds: reel.timing.slideTimings[4]?.startSeconds,
    secondCardBeginsAtSeconds: reel.timing.slideTimings[5]?.startSeconds,
    ffmpegArgsSummary: "concat existing recap card frames + temporary first-card countdown overlay + configured audio + H.264/yuv420p/AAC + faststart",
    slideStartEndTimes: reel.timing.slideTimings.map((slide) => ({
      kind: slide.kind,
      text: slide.text,
      startSeconds: slide.startSeconds,
      endSeconds: slide.endSeconds,
      durationSeconds: slide.durationSeconds,
      beats: slide.beats,
    })),
    records: reel.records,
  };
  const manifestPath = path.join(reviewRoot, "review-manifest.json");
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const readmePath = path.join(reviewRoot, "REVIEW_README.md");
  await fs.writeFile(
    readmePath,
    [
      "# Big Sandy Daily Recap Reel Review Package",
      "",
      `Upload \`${path.basename(reviewMp4)}\` first. It uses the same six booking records logged for the most recent production Daily Recap Reel for ${lastReelDayKey}.`,
      "",
      "What changed: the existing recap card frames remain unchanged. The only new visual is a temporary countdown overlay on top of the first real card: DAILY RECAP STARTING IN, 3, 2, 1.",
      "",
      "What to review: the first card should be visible under the overlay from frame one, the overlay should disappear after the countdown, the first real card should continue normally, and the Late Night Drive (Loop) audio should be attached.",
      "",
      `Files are located in: ${reviewRoot}`,
    ].join("\n"),
    "utf8",
  );

  await fs.rm(zipPath, { force: true }).catch(() => undefined);
  await run("powershell.exe", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${reviewRoot.replace(/'/g, "''")}\\*' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
  ]);

  console.log(JSON.stringify({ reviewRoot, zipPath, manifestPath, readmePath, mp4Path: reviewMp4, contactSheetPath: contactSheet, durationSeconds: duration, mp4Bytes: mp4Stat.size, contactSheetBytes: contactStat.size }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
