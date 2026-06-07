import {
  canonicalizeOfficialNewsUrl,
  hashOfficialNewsText,
  normalizeWhitespace,
  officialNewsSources,
  stripHtml,
  type OfficialNewsListItem,
  type OfficialNewsSourceConfig,
  type ParsedOfficialNewsStory,
} from "./official-news";

const KSP_BASE_URL = "https://www.kentuckystatepolice.ky.gov";

function attr(tag: string, name: string) {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
  return match?.[1];
}

function firstMatch(value: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return normalizeWhitespace(match[1]);
  }
  return undefined;
}

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function postNumberFromSource(source: OfficialNewsSourceConfig): 8 | 9 | undefined {
  const value = source.metadata?.postNumber;
  return value === 8 || value === 9 ? value : undefined;
}

function postNumberFromText(value: string, fallback?: 8 | 9): 8 | 9 | undefined {
  const match = value.match(/\bPost\s*(8|9)\b/i);
  if (match?.[1] === "8" || match?.[1] === "9") return Number(match[1]) as 8 | 9;
  return fallback;
}

function inferCounty(value: string) {
  return firstMatch(value, [
    /(?:^|[\s,.(])([A-Z][A-Za-z]+)\s+County\b/,
    /(?:^|[\s,.(])([A-Z][A-Za-z]+)\s+Co\./,
  ]);
}

function inferCity(value: string) {
  return firstMatch(value, [
    /\b(?:in|near|outside of)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?),\s+Kentucky\b/,
    /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?),\s+KY\b/,
  ]);
}

function titleFromAnchor(anchorHtml: string, href: string) {
  const aria = attr(anchorHtml, "aria-label");
  if (aria) return normalizeWhitespace(aria.replace(/^Read more about\s+/i, ""));
  const text = stripHtml(anchorHtml);
  return text || href.split("/").filter(Boolean).at(-1)?.replace(/[-_]+/g, " ") || "Kentucky State Police update";
}

export function parseKspNewsList(html: string, source: OfficialNewsSourceConfig): OfficialNewsListItem[] {
  const seen = new Set<string>();
  const items: OfficialNewsListItem[] = [];
  const fallbackPost = postNumberFromSource(source);
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchorPattern.exec(html))) {
    const href = match[1];
    if (!href || !/\/news\//i.test(href)) continue;
    if (/tag=post-[89]/i.test(href)) continue;

    const canonicalUrl = canonicalizeOfficialNewsUrl(href, KSP_BASE_URL);
    const dedupe = canonicalUrl.toLowerCase();
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);

    const anchorHtml = match[0];
    const nearby = html.slice(Math.max(0, match.index - 400), Math.min(html.length, match.index + anchorHtml.length + 600));
    const title = titleFromAnchor(anchorHtml, href);
    const dateText =
      attr(anchorHtml, "data-date") ??
      firstMatch(nearby, [
        /datetime=["']([^"']+)["']/i,
        /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4})\b/i,
        /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
      ]);

    items.push({
      sourceSlug: source.slug,
      sourceUrl: source.listUrl,
      canonicalUrl,
      title,
      publishedAt: parseDate(dateText),
      postNumber: postNumberFromText(`${title} ${nearby}`, fallbackPost),
    });
  }

  return items;
}

export function parseKspNewsDetail(
  html: string,
  source: OfficialNewsSourceConfig,
  canonicalUrl: string,
): ParsedOfficialNewsStory {
  const fallbackPost = postNumberFromSource(source);
  const title =
    firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<h1[^>]*>([\s\S]*?)<\/h1>/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) ?? "Kentucky State Police update";
  const description = firstMatch(html, [
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
  ]);
  const dateText = firstMatch(html, [
    /<meta[^>]+property=["']article:published_time["'][^>]+content=["']([^"']+)["']/i,
    /<time[^>]+datetime=["']([^"']+)["']/i,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},\s+\d{4})\b/i,
    /\b(\d{1,2}\/\d{1,2}\/\d{4})\b/,
  ]);
  const updatedText = firstMatch(html, [
    /<meta[^>]+property=["']article:modified_time["'][^>]+content=["']([^"']+)["']/i,
    /Updated\s*:?\s*([^<\n]+)/i,
  ]);
  const image = firstMatch(html, [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
  ]);
  const articleHtml =
    firstMatch(html, [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<main[^>]*>([\s\S]*?)<\/main>/i,
    ]) ?? html;
  const articleBodyHtml = articleHtml.replace(/<h1[^>]*>[\s\S]*?<\/h1>/gi, " ");
  const bodyText = stripHtml(articleBodyHtml);
  const descriptionText = description ? stripHtml(description) : "";
  const sourceText = bodyText.length > 80 ? bodyText : normalizeWhitespace(`${descriptionText} ${bodyText}`);
  const postNumber = postNumberFromText(`${title} ${sourceText}`, fallbackPost);
  const officialImageUrl = image ? canonicalizeOfficialNewsUrl(image, KSP_BASE_URL) : undefined;
  const tags = [...html.matchAll(/(?:tag|category)["'][^>]*>\s*([^<]+)\s*</gi)].map((tag) => normalizeWhitespace(tag[1]));

  return {
    sourceSlug: source.slug,
    sourceUrl: source.listUrl,
    canonicalUrl: canonicalizeOfficialNewsUrl(canonicalUrl, KSP_BASE_URL),
    title: normalizeWhitespace(title.replace(/\s*\|\s*Kentucky State Police\s*$/i, "")),
    publishedAt: parseDate(dateText),
    updatedAt: parseDate(updatedText),
    postNumber,
    sourceName: source.name,
    agency: source.agency,
    postLabel: postNumber ? `KSP Post ${postNumber}` : source.attributionLabel,
    county: inferCounty(`${title} ${sourceText}`),
    city: inferCity(`${title} ${sourceText}`),
    region: source.region,
    sourceText,
    officialImageUrl,
    authorLabel: firstMatch(html, [/By\s+([^<\n]+)/i]) ?? source.attributionLabel,
    tags,
    sourceTextHash: hashOfficialNewsText(sourceText),
  };
}

export function kspSources() {
  return officialNewsSources.filter((source) => source.parserKey === "ksp-news");
}
