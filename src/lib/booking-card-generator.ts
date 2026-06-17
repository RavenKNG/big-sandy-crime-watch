import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  bookingImageAbsolutePathFromPublicPath,
  bookingGeneratedImagePublicPath,
  writeBookingGeneratedImageFromBuffer,
} from "./booking-image-storage";
import { absoluteSiteUrl, formatBookingDateTime } from "./display-format";

export type BookingCardRecord = {
  slug: string;
  displayName: string;
  age?: number | null;
  bookingDateTimeText?: string | null;
  bookingTimeKnown?: boolean | null;
  recordDate?: Date | string | null;
  arrestingAgency?: string | null;
  sourceName?: string | null;
  imageUrl?: string | null;
  imageLocalPath?: string | null;
};

export type BookingCardImagePaths = {
  previewPath: string;
  fullPath: string;
};

const SITE_LABEL = "BIGSANDYCRIMEWATCH.COM";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function uppercase(value?: string | null, fallback = "NOT LISTED") {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized.toUpperCase() : fallback;
}

function displayCardDate(record: BookingCardRecord) {
  return (
    formatBookingDateTime(record.bookingDateTimeText, false) ||
    formatBookingDateTime(record.recordDate, false) ||
    "Date unavailable"
  );
}

function splitName(name: string) {
  const parts = uppercase(name, "NAME UNAVAILABLE").split(" ");
  if (parts.length <= 3) return parts;
  return [parts.slice(0, -2).join(" "), parts.at(-2) ?? "", parts.at(-1) ?? ""].filter(Boolean);
}

function wrapText(value: string, maxChars: number, maxLines = 3) {
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

function tspans(lines: string[], x: number, y: number, lineHeight: number) {
  return lines
    .map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`)
    .join("");
}

function fittedFontSize(lines: string[], baseSize: number, minSize: number, idealCharsPerLine: number) {
  const longest = Math.max(...lines.map((line) => line.length), 1);
  return Math.max(minSize, Math.min(baseSize, Math.floor(baseSize * (idealCharsPerLine / longest))));
}

function brandMark(x: number, y: number, size: number) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  return `
    <g>
      <circle cx="${cx}" cy="${cy}" r="${size / 2}" fill="#111319" stroke="#d51f2a" stroke-width="${size * 0.055}"/>
      <circle cx="${cx}" cy="${cy}" r="${size * 0.39}" fill="#050607" stroke="rgba(255,255,255,0.14)" stroke-width="${size * 0.018}"/>
      <text x="${cx}" y="${cy - size * 0.12}" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${size * 0.16}" fill="#f5f5f5" font-weight="900">BIG</text>
      <text x="${cx}" y="${cy + size * 0.06}" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${size * 0.14}" fill="#ef2634" font-weight="900">SANDY</text>
      <text x="${cx}" y="${cy + size * 0.22}" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${size * 0.09}" fill="#f5f5f5" font-weight="900" letter-spacing="${size * 0.01}">CRIME WATCH</text>
    </g>
  `;
}

function textureDefs() {
  return `
    <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" result="noise"/>
      <feColorMatrix in="noise" type="saturate" values="0"/>
      <feComponentTransfer>
        <feFuncA type="table" tableValues="0 0.18"/>
      </feComponentTransfer>
      <feBlend mode="soft-light" in2="SourceGraphic"/>
    </filter>
    <linearGradient id="darkBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1b20"/>
      <stop offset="45%" stop-color="#101116"/>
      <stop offset="100%" stop-color="#050506"/>
    </linearGradient>
    <linearGradient id="redBar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#9e141c"/>
      <stop offset="55%" stop-color="#e02430"/>
      <stop offset="100%" stop-color="#7f1016"/>
    </linearGradient>
    <radialGradient id="photoShade" cx="50%" cy="45%" r="72%">
      <stop offset="0%" stop-color="rgba(255,255,255,0)"/>
      <stop offset="100%" stop-color="rgba(0,0,0,0.42)"/>
    </radialGradient>
  `;
}

async function readSourceImage(record: BookingCardRecord) {
  let source = record.imageUrl || record.imageLocalPath;
  if (!source) return null;

  if (/^https?:\/\//i.test(source)) {
    const url = new URL(source);
    if (url.pathname.startsWith("/booking-images/")) source = url.pathname;
  }

  if (/^https?:\/\//i.test(source)) {
    const response = await fetch(source);
    if (!response.ok) return null;
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") || "image/jpeg",
    };
  }

  const absolutePath = bookingImageAbsolutePathFromPublicPath(source);
  if (!absolutePath) return null;

  try {
    const bytes = await fs.readFile(path.resolve(absolutePath));
    const ext = absolutePath.split(".").pop()?.toLowerCase();
    return {
      bytes,
      mimeType: ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg",
    };
  } catch {
    return null;
  }
}

function photoSvg(source: Awaited<ReturnType<typeof readSourceImage>>, x: number, y: number, width: number, height: number) {
  if (!source) {
    return `
      <g>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="#30343b"/>
        <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#photoShade)"/>
        ${Array.from({ length: 8 })
          .map((_, i) => `<line x1="${x + 34}" y1="${y + 60 + i * 54}" x2="${x + width - 34}" y2="${y + 60 + i * 54}" stroke="rgba(255,255,255,0.22)" stroke-width="4"/>`)
          .join("")}
        <circle cx="${x + width / 2}" cy="${y + height * 0.42}" r="${Math.min(width, height) * 0.13}" fill="#171a20"/>
        <path d="M${x + width * 0.32} ${y + height * 0.78}c22-92 98-130 160-130s138 38 160 130Z" fill="#171a20"/>
        <text x="${x + width / 2}" y="${y + height - 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="30" font-weight="800" fill="#f4f6f8">BOOKING PHOTO UNAVAILABLE</text>
      </g>
    `;
  }

  const href = `data:${source.mimeType};base64,${source.bytes.toString("base64")}`;
  return `
    <g>
      <image href="${href}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice"/>
      <rect x="${x}" y="${y}" width="${width}" height="${height}" fill="url(#photoShade)"/>
    </g>
  `;
}

function watermark(x: number, y: number, width: number, height: number, fontSize = 42) {
  return `
    <g transform="rotate(-29 ${x + width / 2} ${y + height / 2})">
      <text x="${x + width / 2}" y="${y + height / 2}" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="rgba(255,255,255,0.22)" stroke="rgba(0,0,0,0.18)" stroke-width="2" letter-spacing="2">${SITE_LABEL}</text>
    </g>
  `;
}

function previewSvg(record: BookingCardRecord, source: Awaited<ReturnType<typeof readSourceImage>>) {
  const nameLines = splitName(record.displayName).slice(0, 4);
  const agency = uppercase(record.arrestingAgency ?? record.sourceName, "NOT LISTED");
  const booked = uppercase(displayCardDate(record), "DATE UNAVAILABLE");

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
      <defs>${textureDefs()}</defs>
      <rect width="1200" height="630" fill="url(#darkBg)"/>
      <rect x="18" y="18" width="1164" height="594" fill="rgba(0,0,0,0.18)" stroke="#b71723" stroke-width="4"/>
      <rect x="44" y="44" width="414" height="542" fill="rgba(8,8,10,0.66)" filter="url(#paperNoise)"/>
      ${brandMark(58, 54, 78)}
      <text x="150" y="82" font-family="Arial Black, Impact, Arial, sans-serif" font-size="30" font-weight="900" fill="#f4f4f5" letter-spacing="1">BIG SANDY</text>
      <text x="150" y="113" font-family="Arial Black, Impact, Arial, sans-serif" font-size="20" font-weight="900" fill="#f4f4f5" letter-spacing="2">CRIME WATCH</text>
      <rect x="150" y="132" width="230" height="34" fill="url(#redBar)"/>
      <text x="165" y="156" font-family="Arial Black, Impact, Arial, sans-serif" font-size="20" fill="#fff" letter-spacing="4">BOOKING REPORT</text>
      <text x="72" y="230" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${nameLines.join("").length > 22 ? 40 : 48}" font-weight="900" fill="#f3f4f6" letter-spacing="1">
        ${tspans(nameLines, 72, 230, 50)}
      </text>
      <text x="72" y="436" font-family="Arial Black, Impact, Arial, sans-serif" font-size="23" font-weight="900" fill="#e02430">BOOKED: <tspan fill="#f3f4f6">${escapeXml(booked)}</tspan></text>
      <text x="72" y="474" font-family="Arial Black, Impact, Arial, sans-serif" font-size="22" font-weight="900" fill="#e02430">AGENCY: <tspan fill="#f3f4f6">${escapeXml(agency.length > 24 ? `${agency.slice(0, 23)}...` : agency)}</tspan></text>
      <text x="72" y="536" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="#f3f4f6">VIEW FULL CHARGES &amp; DETAILS:</text>
      <rect x="72" y="548" width="350" height="31" fill="#a9151f"/>
      <text x="88" y="570" font-family="Arial Black, Impact, Arial, sans-serif" font-size="16" fill="#fff" letter-spacing="1.2">${SITE_LABEL}</text>
      <rect x="472" y="18" width="4" height="594" fill="#d51f2a"/>
      <clipPath id="previewPhoto"><rect x="476" y="18" width="704" height="594"/></clipPath>
      <g clip-path="url(#previewPhoto)">
        ${photoSvg(source, 476, 18, 704, 594)}
        ${watermark(476, 18, 704, 594, 44)}
      </g>
      <rect x="476" y="18" width="704" height="594" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
      <text x="600" y="600" font-family="Arial Black, Impact, Arial, sans-serif" font-size="16" fill="#fff" letter-spacing="3">ARREST DOES NOT IMPLY GUILT.</text>
    </svg>
  `.trim();
}

function fullSvg(record: BookingCardRecord, source: Awaited<ReturnType<typeof readSourceImage>>) {
  const agency = uppercase(record.arrestingAgency ?? record.sourceName, "NOT LISTED");
  const booked = uppercase(displayCardDate(record), "DATE UNAVAILABLE");
  const nameLines = wrapText(uppercase(record.displayName, "NAME UNAVAILABLE"), 24, 2);
  const bookedLines = wrapText(booked, 18, 2);
  const agencyLines = wrapText(agency, 24, 2);
  const nameFontSize = fittedFontSize(nameLines, 30, 21, 22);
  const bookedFontSize = fittedFontSize(bookedLines, 23, 18, 18);
  const agencyFontSize = fittedFontSize(agencyLines, 24, 16, 22);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
      <defs>${textureDefs()}</defs>
      <rect width="1200" height="1200" fill="url(#darkBg)"/>
      <rect x="20" y="20" width="1160" height="1160" fill="rgba(0,0,0,0.16)" stroke="#b71723" stroke-width="4"/>
      <rect x="42" y="42" width="1116" height="146" fill="#111216" stroke="#2a2b31"/>
      ${brandMark(58, 54, 96)}
      <text x="178" y="104" font-family="Arial Black, Impact, Arial, sans-serif" font-size="56" font-weight="900" fill="#f4f4f5" letter-spacing="2">BIG SANDY CRIME WATCH</text>
      <rect x="178" y="124" width="520" height="38" fill="url(#redBar)"/>
      <text x="310" y="151" font-family="Arial Black, Impact, Arial, sans-serif" font-size="22" fill="#fff" letter-spacing="9">BOOKING REPORT</text>
      <clipPath id="fullPhoto"><rect x="42" y="188" width="1116" height="662"/></clipPath>
      <g clip-path="url(#fullPhoto)">
        ${photoSvg(source, 42, 188, 1116, 662)}
        ${watermark(42, 188, 1116, 662, 64)}
      </g>
      <rect x="42" y="188" width="1116" height="662" fill="none" stroke="#b71723" stroke-width="3"/>
      <rect x="42" y="850" width="1116" height="132" fill="#111216" stroke="#2a2b31"/>
      <line x1="552" y1="850" x2="552" y2="982" stroke="#b71723" stroke-width="3"/>
      <line x1="822" y1="850" x2="822" y2="982" stroke="#b71723" stroke-width="3"/>
      <text x="76" y="888" font-family="Arial Black, Impact, Arial, sans-serif" font-size="20" fill="#e02430">NAME:</text>
      <text x="76" y="926" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${nameFontSize}" fill="#fff">${tspans(nameLines, 76, 926, 33)}</text>
      <text x="586" y="888" font-family="Arial Black, Impact, Arial, sans-serif" font-size="20" fill="#e02430">BOOKED:</text>
      <text x="586" y="928" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${bookedFontSize}" fill="#fff">${tspans(bookedLines, 586, 928, 28)}</text>
      <text x="856" y="888" font-family="Arial Black, Impact, Arial, sans-serif" font-size="20" fill="#e02430">AGENCY:</text>
      <text x="856" y="928" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${agencyFontSize}" fill="#fff">${tspans(agencyLines, 856, 928, 27)}</text>
      <rect x="42" y="982" width="1116" height="76" fill="url(#redBar)"/>
      <text x="600" y="1029" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="24" fill="#fff" letter-spacing="1.2">VIEW FULL CHARGES &amp; DETAILS AT: ${SITE_LABEL}</text>
      <text x="600" y="1096" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="18" fill="#fff" letter-spacing="1.5">ARREST DOES NOT IMPLY GUILT. ALL INDIVIDUALS ARE PRESUMED INNOCENT</text>
      <text x="600" y="1128" text-anchor="middle" font-family="Arial Black, Impact, Arial, sans-serif" font-size="18" fill="#fff" letter-spacing="1.5">UNLESS PROVEN GUILTY IN COURT.</text>
    </svg>
  `.trim();
}

async function pngFromSvg(svg: string) {
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export function bookingCardPublicPath(recordSlug: string, kind: "preview" | "full") {
  return bookingGeneratedImagePublicPath(recordSlug, kind);
}

export function bookingCardPublicUrl(recordSlug: string, kind: "preview" | "full", site?: string) {
  return absoluteSiteUrl(bookingCardPublicPath(recordSlug, kind), site);
}

export async function generateBookingCardImages(record: BookingCardRecord): Promise<BookingCardImagePaths> {
  const source = await readSourceImage(record);
  const [preview, full] = await Promise.all([
    pngFromSvg(previewSvg(record, source)),
    pngFromSvg(fullSvg(record, source)),
  ]);

  const [previewPath, fullPath] = await Promise.all([
    writeBookingGeneratedImageFromBuffer(record.slug, "preview", preview),
    writeBookingGeneratedImageFromBuffer(record.slug, "full", full),
  ]);

  return { previewPath, fullPath };
}

export async function ensureBookingCardImages(record: BookingCardRecord): Promise<BookingCardImagePaths> {
  const previewPath = bookingCardPublicPath(record.slug, "preview");
  const fullPath = bookingCardPublicPath(record.slug, "full");
  const previewFile = bookingImageAbsolutePathFromPublicPath(previewPath);
  const fullFile = bookingImageAbsolutePathFromPublicPath(fullPath);

  if (previewFile && fullFile) {
    try {
      await Promise.all([fs.access(previewFile), fs.access(fullFile)]);
      return { previewPath, fullPath };
    } catch {
      // Missing or moved generated assets are rebuilt below.
    }
  }

  return generateBookingCardImages(record);
}
