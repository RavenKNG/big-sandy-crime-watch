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
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#2a3341"/>
          <stop offset="100%" stop-color="#1c2430"/>
        </linearGradient>
        <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="rgba(228,59,63,0.18)"/>
          <stop offset="100%" stop-color="rgba(241,184,75,0.10)"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)"/>
      <rect x="40" y="40" width="720" height="920" rx="28" fill="rgba(10,14,22,0.62)" stroke="rgba(255,255,255,0.08)"/>
      <rect x="118" y="126" width="564" height="556" rx="20" fill="url(#wall)" stroke="rgba(255,255,255,0.08)"/>
      <line x1="210" y1="180" x2="210" y2="648" stroke="rgba(255,255,255,0.10)" stroke-width="5"/>
      <line x1="400" y1="180" x2="400" y2="648" stroke="rgba(255,255,255,0.10)" stroke-width="5"/>
      <line x1="590" y1="180" x2="590" y2="648" stroke="rgba(255,255,255,0.10)" stroke-width="5"/>
      <line x1="140" y1="210" x2="660" y2="210" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
      <line x1="140" y1="308" x2="660" y2="308" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
      <line x1="140" y1="406" x2="660" y2="406" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
      <line x1="140" y1="504" x2="660" y2="504" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
      <line x1="140" y1="602" x2="660" y2="602" stroke="rgba(255,255,255,0.06)" stroke-width="3"/>
      <rect x="182" y="704" width="436" height="86" rx="14" fill="rgba(9,13,20,0.84)" stroke="rgba(255,255,255,0.08)"/>
      <text x="400" y="755" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="800" fill="#f6f8fb">Mugshot Not Available</text>
      <rect x="110" y="818" width="580" height="104" rx="24" fill="url(#panel)" stroke="rgba(241,184,75,0.18)"/>
      <text x="400" y="868" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#f1b84b" letter-spacing="2">PUBLIC RECORD</text>
      <text x="400" y="905" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#c9d2de">BigSandyCrimeWatch.com</text>
      <circle cx="154" cy="868" r="58" fill="rgba(228,59,63,0.13)" stroke="rgba(228,59,63,0.34)" stroke-width="5"/>
      <text x="154" y="856" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="800" fill="#f7f9fb">BIG SANDY</text>
      <text x="154" y="874" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="800" fill="#f1b84b">CRIME WATCH</text>
      <text x="154" y="892" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="700" fill="#f7f9fb">PUBLIC RECORD</text>
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
      <rect x="458" y="810" width="314" height="132" rx="18" fill="rgba(8,11,16,0.56)" stroke="rgba(241,184,75,0.28)" stroke-width="3"/>
      <circle cx="514" cy="876" r="34" fill="rgba(228,59,63,0.14)" stroke="rgba(228,59,63,0.42)" stroke-width="3"/>
      <text x="514" y="868" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="800" fill="#f7f9fb">BIG</text>
      <text x="514" y="880" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="8" font-weight="800" fill="#f1b84b">SANDY</text>
      <text x="514" y="892" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="7" font-weight="800" fill="#f7f9fb">WATCH</text>
      <text x="560" y="856" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="800" fill="#f7f9fb">Big Sandy Crime Watch</text>
      <text x="560" y="884" font-family="Arial, Helvetica, sans-serif" font-size="13" font-weight="700" fill="#f1b84b" letter-spacing="1.1">PUBLIC RECORD</text>
      <text x="560" y="914" font-family="Arial, Helvetica, sans-serif" font-size="16" fill="#dde5f0">BigSandyCrimeWatch.com</text>
      <text x="28" y="964" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="rgba(255,255,255,0.70)">BIGSANDYCRIMEWATCH.COM</text>
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
