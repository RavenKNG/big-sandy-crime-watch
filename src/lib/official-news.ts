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

export function stripHtml(value: string) {
  return normalizeWhitespace(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/gi, '"')
      .replace(/&mdash;/gi, "-")
      .replace(/&ndash;/gi, "-")
      .replace(/&#8211;/g, "-")
      .replace(/&#8217;/g, "'"),
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

function removeBoilerplate(value: string) {
  return normalizeWhitespace(
    value
      .replace(/Updated:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\s*/gi, "")
      .replace(/Kentucky State Police[, ]+Post\s+\d+\s*/gi, "Kentucky State Police ")
      .replace(/Anyone with information[\s\S]*$/i, "")
      .replace(/This is an ongoing investigation[\s\S]*$/i, "This is an ongoing investigation."),
  );
}

export function createOfficialNewsArticleDraft(story: ParsedOfficialNewsStory): OfficialNewsArticleDraft {
  const text = removeBoilerplate(story.sourceText);
  const sentences = splitSentences(text);
  const region = story.county ? `${story.county} County` : story.city ?? story.region ?? story.postLabel ?? "the region";
  const firstFacts = sentences.slice(0, 4);
  const summarySentence =
    firstFacts[0] ??
    `Big Sandy Crime Watch is tracking a Kentucky State Police update involving ${region}.`;
  const summary = summarySentence.length > 280 ? `${summarySentence.slice(0, 277).trim()}...` : summarySentence;
  const factParagraphs =
    firstFacts.length > 0
      ? firstFacts.map((sentence) => `According to Kentucky State Police, ${sentence.replace(/^According to Kentucky State Police,\s*/i, "")}`)
      : [`Big Sandy Crime Watch is tracking a Kentucky State Police update involving ${region}.`];

  const body = [
    `Big Sandy Crime Watch summary:`,
    "",
    ...factParagraphs.slice(0, 5),
    "",
    `This story is based on information released by ${story.postLabel ?? "Kentucky State Police"}.`,
    "",
    `Source: Kentucky State Police`,
    story.canonicalUrl,
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
