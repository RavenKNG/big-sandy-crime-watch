import fs from "node:fs/promises";
import { bookingImageAbsolutePathFromPublicPath } from "@/lib/booking-image-storage";

export const dynamic = "force-dynamic";

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function readSourceImage(src?: string | null) {
  if (!src) return null;

  if (/^https?:\/\//i.test(src)) {
    const response = await fetch(src);
    if (!response.ok) return null;
    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      mimeType: response.headers.get("content-type") || "image/jpeg",
    };
  }

  const absolutePath = bookingImageAbsolutePathFromPublicPath(src);
  if (!absolutePath) return null;

  try {
    const bytes = await fs.readFile(absolutePath);
    const extension = absolutePath.split(".").pop()?.toLowerCase();
    return {
      bytes,
      mimeType:
        extension === "png"
          ? "image/png"
          : extension === "webp"
            ? "image/webp"
            : "image/jpeg",
    };
  } catch {
    return null;
  }
}

function fallbackSvg() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#0f1724"/>
          <stop offset="50%" stop-color="#162033"/>
          <stop offset="100%" stop-color="#090d14"/>
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(228,59,63,0.22)"/>
          <stop offset="100%" stop-color="rgba(241,184,75,0.12)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect x="40" y="40" width="720" height="920" rx="28" fill="rgba(10,14,22,0.62)" stroke="rgba(255,255,255,0.08)"/>
      <circle cx="400" cy="320" r="126" fill="rgba(255,255,255,0.04)" stroke="rgba(241,184,75,0.28)" stroke-width="10"/>
      <path d="M400 230l54 80h-32l40 86-62-53-62 53 40-86h-32z" fill="rgba(241,184,75,0.55)"/>
      <rect x="110" y="560" width="580" height="180" rx="24" fill="url(#panel)" stroke="rgba(241,184,75,0.18)"/>
      <text x="400" y="625" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="800" fill="#f6f8fb">Mugshot Not Available</text>
      <text x="400" y="676" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#f1b84b" letter-spacing="2">PUBLIC RECORD</text>
      <text x="400" y="724" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#c9d2de">BigSandyCrimeWatch.com</text>
      <circle cx="152" cy="846" r="66" fill="rgba(228,59,63,0.16)" stroke="rgba(228,59,63,0.38)" stroke-width="6"/>
      <text x="152" y="832" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" font-weight="800" fill="#f7f9fb">BIG SANDY</text>
      <text x="152" y="852" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="14" font-weight="800" fill="#f1b84b">CRIME WATCH</text>
      <text x="152" y="872" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" fill="#f7f9fb">PUBLIC RECORD</text>
    </svg>
  `.trim();
}

function brandedSvg(source: { bytes: Buffer; mimeType: string }) {
  const href = `data:${source.mimeType};base64,${source.bytes.toString("base64")}`;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1000" width="800" height="1000">
      <defs>
        <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(0,0,0,0)"/>
          <stop offset="100%" stop-color="rgba(0,0,0,0.72)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="#0f1724"/>
      <image href="${href}" x="0" y="0" width="800" height="1000" preserveAspectRatio="xMidYMid slice"/>
      <rect x="0" y="770" width="800" height="230" fill="url(#fade)"/>
      <rect x="24" y="804" width="226" height="154" rx="22" fill="rgba(10,14,22,0.62)" stroke="rgba(241,184,75,0.35)" stroke-width="4"/>
      <circle cx="92" cy="880" r="44" fill="rgba(228,59,63,0.18)" stroke="rgba(228,59,63,0.52)" stroke-width="4"/>
      <text x="92" y="872" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="800" fill="#f7f9fb">BIG</text>
      <text x="92" y="886" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="800" fill="#f1b84b">SANDY</text>
      <text x="92" y="900" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="9" font-weight="800" fill="#f7f9fb">WATCH</text>
      <text x="156" y="862" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="800" fill="#f7f9fb">Big Sandy Crime Watch</text>
      <text x="156" y="894" font-family="Arial, Helvetica, sans-serif" font-size="16" font-weight="700" fill="#f1b84b" letter-spacing="1.3">PUBLIC RECORD</text>
      <text x="156" y="922" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#dde5f0">BigSandyCrimeWatch.com</text>
      <text x="776" y="960" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="rgba(255,255,255,0.74)">BIGSANDYCRIMEWATCH.COM</text>
    </svg>
  `.trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const src = searchParams.get("src");
  const image = await readSourceImage(src);
  const svg = image ? brandedSvg(image) : fallbackSvg();
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      "Content-Disposition": `inline; filename="${escapeXml(image ? "big-sandy-branded-mugshot.svg" : "big-sandy-mugshot-fallback.svg")}"`,
    },
  });
}

