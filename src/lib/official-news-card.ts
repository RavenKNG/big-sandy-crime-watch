import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import { bookingImageStorageRoot } from "./booking-image-storage";
import { slugifyOfficialNews, type ParsedOfficialNewsStory } from "./official-news";

export type OfficialNewsCardInput = Pick<
  ParsedOfficialNewsStory,
  "title" | "postLabel" | "publishedAt" | "county" | "city" | "region" | "canonicalUrl"
>;

export type OfficialNewsCardData = {
  slug: string;
  title: string;
  label: string;
  dateLabel: string;
  locationLabel: string;
  sourceLabel: string;
  watermark: string;
  canonicalUrl: string;
};

export type OfficialNewsCardResult = {
  horizontalPath: string;
  verticalPath: string;
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wrapText(value: string, maxChars: number, maxLines: number) {
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
  return lines.map((line, index) => `<tspan x="${x}" y="${y + index * lineHeight}">${escapeXml(line)}</tspan>`).join("");
}

function dateLabel(value?: Date) {
  if (!value) return "DATE PENDING";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value).toUpperCase();
}

export function officialNewsCardData(story: OfficialNewsCardInput): OfficialNewsCardData {
  return {
    slug: slugifyOfficialNews(story.title),
    title: story.title,
    label: (story.postLabel ?? "KSP UPDATE").toUpperCase(),
    dateLabel: dateLabel(story.publishedAt),
    locationLabel: (story.county ? `${story.county} County` : story.city ?? story.region ?? "KSP Region").toUpperCase(),
    sourceLabel: "Source: Kentucky State Police",
    watermark: "BigSandyCrimeWatch.com",
    canonicalUrl: story.canonicalUrl,
  };
}

function cardSvg(data: OfficialNewsCardData, width: number, height: number) {
  const titleLines = wrapText(data.title.toUpperCase(), width > height ? 33 : 22, width > height ? 3 : 5);
  const titleSize = width > height ? 56 : 68;
  const x = width > height ? 78 : 70;
  const titleY = width > height ? 260 : 430;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#101215"/>
          <stop offset="58%" stop-color="#20242a"/>
          <stop offset="100%" stop-color="#08090b"/>
        </linearGradient>
        <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#b71c28"/>
          <stop offset="100%" stop-color="#f0c04a"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bg)"/>
      <rect x="0" y="0" width="${width}" height="${height}" fill="none" stroke="#b71c28" stroke-width="${width > height ? 18 : 20}"/>
      <rect x="${x}" y="${width > height ? 70 : 88}" width="${width > height ? 430 : 520}" height="${width > height ? 52 : 62}" fill="url(#bar)"/>
      <text x="${x + 24}" y="${width > height ? 106 : 130}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${width > height ? 28 : 34}" font-weight="900" fill="#fff">${escapeXml(data.label)}</text>
      <text x="${x}" y="${width > height ? 178 : 235}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${width > height ? 38 : 48}" font-weight="900" fill="#fff">BIG SANDY CRIME WATCH</text>
      <text x="${x}" y="${titleY}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${titleSize}" font-weight="900" fill="#f7f7f7">${tspans(titleLines, x, titleY, titleSize + 8)}</text>
      <rect x="${x}" y="${height - (width > height ? 150 : 260)}" width="${width - x * 2}" height="${width > height ? 82 : 120}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.18)"/>
      <text x="${x + 24}" y="${height - (width > height ? 100 : 190)}" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${width > height ? 27 : 37}" fill="#f0c04a">${escapeXml(data.locationLabel)}</text>
      <text x="${x + 24}" y="${height - (width > height ? 62 : 136)}" font-family="Arial, sans-serif" font-size="${width > height ? 23 : 31}" font-weight="800" fill="#fff">${escapeXml(data.dateLabel)} · ${escapeXml(data.sourceLabel)}</text>
      <text x="${width - x}" y="${height - 38}" text-anchor="end" font-family="Arial Black, Impact, Arial, sans-serif" font-size="${width > height ? 25 : 35}" fill="rgba(255,255,255,0.76)">${escapeXml(data.watermark)}</text>
    </svg>
  `.trim();
}

async function writePng(publicSlug: string, filename: string, svg: string) {
  const directory = path.join(bookingImageStorageRoot(), publicSlug);
  await fs.mkdir(directory, { recursive: true });
  const destination = path.join(directory, filename);
  await fs.writeFile(destination, await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer());
  return `/booking-images/${publicSlug}/${filename}`;
}

export async function generateOfficialNewsCards(story: OfficialNewsCardInput): Promise<OfficialNewsCardResult> {
  const data = officialNewsCardData(story);
  const [horizontalPath, verticalPath] = await Promise.all([
    writePng(data.slug, "official-news-card-1200x630.png", cardSvg(data, 1200, 630)),
    writePng(data.slug, "official-news-card-1080x1920.png", cardSvg(data, 1080, 1920)),
  ]);
  return { horizontalPath, verticalPath };
}
