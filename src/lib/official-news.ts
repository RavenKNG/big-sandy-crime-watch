import crypto from "node:crypto";

export type OfficialNewsSourceConfig = {
  slug: string;
  name: string;
  agency: string;
  parserKey: "ksp-news";
  sourceType: "state-police-news";
  listUrl: string;
  attributionLabel: string;
  region: string;
  enabledEnv: string;
  autoPostEnv: string;
  scanIntervalMinutes: number;
  metadata?: Record<string, string | number | boolean>;
};

export type OfficialNewsListItem = {
  sourceSlug: string;
  sourceUrl: string;
  canonicalUrl: string;
  title: string;
  publishedAt?: Date;
  postNumber?: 8 | 9;
};

export type ParsedOfficialNewsStory = OfficialNewsListItem & {
  sourceName: string;
  agency: string;
  postLabel?: string;
  updatedAt?: Date;
  county?: string;
  city?: string;
  region?: string;
  sourceText: string;
  officialImageUrl?: string;
  authorLabel?: string;
  tags: string[];
  sourceTextHash: string;
};

export type OfficialNewsArticleDraft = {
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: "public-safety" | "breaking-news";
  county?: string;
  sourceName: string;
  sourceUrl: string;
  sourcePublishedAt?: Date;
};

export const officialNewsSources: OfficialNewsSourceConfig[] = [
  {
    slug: "ksp-post-9-news",
    name: "Kentucky State Police Post 9 News",
    agency: "Kentucky State Police",
    parserKey: "ksp-news",
    sourceType: "state-police-news",
    listUrl: "https://www.kentuckystatepolice.ky.gov/news?tag=post-9",
    attributionLabel: "Kentucky State Police Post 9",
    region: "Post 9 Region",
    enabledEnv: "KSP_IMPORT_ENABLED",
    autoPostEnv: "KSP_AUTO_POST",
    scanIntervalMinutes: 15,
    metadata: { postNumber: 9 },
  },
  {
    slug: "ksp-post-8-news",
    name: "Kentucky State Police Post 8 News",
    agency: "Kentucky State Police",
    parserKey: "ksp-news",
    sourceType: "state-police-news",
    listUrl: "https://www.kentuckystatepolice.ky.gov/news?tag=post-8",
    attributionLabel: "Kentucky State Police Post 8",
    region: "Post 8 Region",
    enabledEnv: "KSP_IMPORT_ENABLED",
    autoPostEnv: "KSP_AUTO_POST",
    scanIntervalMinutes: 15,
    metadata: { postNumber: 8 },
  },
];

export function envFlag(name: string, fallback = false) {
  const value = process.env[name];
  if (value === undefined) return fallback;
  return value.toLowerCase() === "true";
}

export function officialNewsImportEnabled() {
  return envFlag("OFFICIAL_NEWS_IMPORT_ENABLED") && envFlag("KSP_IMPORT_ENABLED");
}

export function officialNewsAutoPostEnabled() {
  return envFlag("OFFICIAL_NEWS_AUTO_POST") && envFlag("KSP_AUTO_POST");
}

export function officialNewsDraftCreationEnabled() {
  return envFlag("KSP_CREATE_FACEBOOK_DRAFTS", true);
}

export function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function decodeHtmlEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    quot: '"',
    apos: "'",
    nbsp: " ",
    hellip: "...",
    mdash: "-",
    ndash: "-",
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (key.startsWith("#x")) {
      const codePoint = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (key.startsWith("#")) {
      const codePoint = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return named[key] ?? match;
  });
}

export function stripHtml(value: string) {
  return normalizeWhitespace(
    decodeHtmlEntities(
      value
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

export function slugifyOfficialNews(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

export function canonicalizeOfficialNewsUrl(input: string, base = "https://www.kentuckystatepolice.ky.gov") {
  const url = new URL(input, base);
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

export function officialNewsDedupeKey(url: string) {
  return canonicalizeOfficialNewsUrl(url).toLowerCase();
}

export function hashOfficialNewsText(value: string) {
  return crypto.createHash("sha256").update(normalizeWhitespace(value)).digest("hex");
}

function splitSentences(value: string) {
  return normalizeWhitespace(value)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 20);
}

function paragraphKey(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^according to kentucky state police,?\s*/i, "")
    .replace(/^kentucky state police says?\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function removeSourceUrls(value: string) {
  return value.replace(/https?:\/\/\S+/gi, " ");
}

export function normalizeOfficialNewsArticleText(value: string, summary?: string) {
  const withoutJunk = decodeHtmlEntities(value)
    .replace(/\[(?:\s*(?:&hellip;|&#8230;|\.{3}|…)\s*)\]/gi, " ")
    .replace(/\[\s*(?:read more|more|continue reading)[^\]]*\]/gi, " ")
    .replace(/Updated:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\s*/gi, " ")
    .replace(/Anyone with information[\s\S]*$/i, " ")
    .replace(/This is an ongoing investigation[\s\S]*$/i, "This is an ongoing investigation.");
  const summaryKey = summary ? paragraphKey(summary) : "";
  const seen = new Set<string>();
  const paragraphs = removeSourceUrls(withoutJunk)
    .split(/\n+|(?<=\.)\s+(?=(?:According to Kentucky State Police|Kentucky State Police|KSP Post|Troopers|This story|Information))/i)
    .map((paragraph) =>
      normalizeWhitespace(
        paragraph
          .replace(/\s*\[\s*(?:\.{3}|…)\s*\]\s*/g, " ")
          .replace(/\b(?:raw\s+source|source)\s*:\s*$/i, " ")
          .replace(/\s+([,.;:!?])/g, "$1"),
      ),
    )
    .filter((paragraph) => paragraph.length > 0)
    .filter((paragraph) => !/^(?:raw\s+source|source)\s*:/i.test(paragraph));

  const cleaned: string[] = [];
  for (const paragraph of paragraphs) {
    const key = paragraphKey(paragraph);
    if (!key || key === summaryKey || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(paragraph);
  }
  return cleaned;
}

export function createOfficialNewsArticleDraft(story: ParsedOfficialNewsStory): OfficialNewsArticleDraft {
  const sourceParagraphs = normalizeOfficialNewsArticleText(story.sourceText);
  const text = sourceParagraphs.join(" ");
  const sentences = splitSentences(text);
  const region = story.county ? `${story.county} County` : story.city ?? story.region ?? story.postLabel ?? "the region";
  const firstFacts = sentences.slice(0, 5);
  const summarySentence =
    firstFacts[0] ??
    `Big Sandy Crime Watch is tracking a Kentucky State Police update involving ${region}.`;
  const summary = summarySentence.length > 280 ? `${summarySentence.slice(0, 277).trim()}...` : summarySentence;
  const bodyParagraphs = normalizeOfficialNewsArticleText(sourceParagraphs.join("\n"), summary);
  const factParagraphs =
    bodyParagraphs.length > 0
      ? bodyParagraphs.slice(0, 6)
      : [`Big Sandy Crime Watch is tracking a Kentucky State Police update involving ${region}.`];

  const body = [
    ...factParagraphs,
    "",
    `This story is based on information released by ${story.postLabel ?? "Kentucky State Police"}.`,
    "",
    "Information is based on the official release available at the time of publication. Additional details may be released by Kentucky State Police.",
  ].join("\n");

  const datePart = story.publishedAt ? `-${story.publishedAt.toISOString().slice(0, 10)}` : "";
  return {
    slug: slugifyOfficialNews(`${story.title}${datePart}`),
    title: story.title,
    summary,
    body,
    category: "public-safety",
    county: story.county,
    sourceName: "Kentucky State Police",
    sourceUrl: story.canonicalUrl,
    sourcePublishedAt: story.publishedAt,
  };
}

export function createOfficialNewsFacebookCaption(
  story: ParsedOfficialNewsStory,
  siteArticleUrl: string,
) {
  const postNumber = story.postNumber ?? (story.postLabel?.match(/\d+/)?.[0] as "8" | "9" | undefined) ?? "?";
  const region = story.county ? `${story.county.toUpperCase()} COUNTY` : (story.region ?? `POST ${postNumber} REGION`).toUpperCase();
  const article = createOfficialNewsArticleDraft(story);
  const summary = article.summary.replace(/\s+/g, " ").trim();

  return [
    `🚨 KSP POST ${postNumber} UPDATE — ${region}`,
    "",
    summary,
    "",
    "Read more:",
    siteArticleUrl,
    "",
    "Source: Kentucky State Police",
  ].join("\n");
}
