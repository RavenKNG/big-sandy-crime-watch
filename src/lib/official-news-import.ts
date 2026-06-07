import { readFile } from "node:fs/promises";
import path from "node:path";
import { createOfficialNewsArticleDraft, officialNewsAutoPostEnabled, officialNewsDraftCreationEnabled, officialNewsImportEnabled, type ParsedOfficialNewsStory } from "./official-news";
import { importOfficialNewsStory, logOfficialNewsEvent, syncOfficialNewsSources } from "./official-news-db";
import { kspSources, parseKspNewsDetail, parseKspNewsList } from "./ksp-news-adapter";

export type OfficialNewsDryRunStory = {
  story: ParsedOfficialNewsStory;
  article: ReturnType<typeof createOfficialNewsArticleDraft>;
  wouldCreateFacebookDraft: boolean;
  wouldAutoPost: boolean;
};

export type OfficialNewsDryRunSourceResult = {
  sourceSlug: string;
  sourceName: string;
  listUrl: string;
  discovered: number;
  parsed: number;
  duplicatesSkipped: number;
  failures: string[];
};

export type OfficialNewsDryRunResult = {
  ok: boolean;
  dryRun: true;
  importEnabled: boolean;
  autoPostEnabled: boolean;
  stories: OfficialNewsDryRunStory[];
  sources: OfficialNewsDryRunSourceResult[];
  duplicatesSkipped: number;
  failures: string[];
};

export type OfficialNewsImportResult = {
  ok: boolean;
  dryRun: false;
  importEnabled: boolean;
  autoPostEnabled: boolean;
  imported: number;
  reused: number;
  failed: number;
  duplicatesSkipped: number;
  articlesCreatedOrUpdated: number;
  facebookDraftsCreatedOrReused: number;
  stories: Array<{
    canonicalUrl: string;
    title: string;
    storyId?: string;
    articleId?: string;
    articleSlug?: string;
    facebookDraftId?: string | null;
    createdStory?: boolean;
    error?: string;
  }>;
  sources: OfficialNewsDryRunSourceResult[];
  failures: string[];
};

async function fetchWithTimeout(url: string, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} failed with status ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

async function readFixture(name: string) {
  return readFile(path.resolve(process.cwd(), "fixtures", "ksp", name), "utf8");
}

type KspWordpressPost = {
  id: number;
  date?: string;
  modified?: string;
  link?: string;
  title?: { rendered?: string };
  content?: { rendered?: string };
  excerpt?: { rendered?: string };
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
};

function kspTagId(sourceSlug: string) {
  if (sourceSlug === "ksp-post-8-news") return 174;
  if (sourceSlug === "ksp-post-9-news") return 243;
  return undefined;
}

function wordpressDetailHtml(post: KspWordpressPost) {
  const title = post.title?.rendered ?? "Kentucky State Police update";
  const image = post._embedded?.["wp:featuredmedia"]?.[0]?.source_url;
  return [
    "<article>",
    `<h1>${title}</h1>`,
    post.date ? `<time datetime="${post.date}"></time>` : "",
    post.modified ? `<p>Updated: ${post.modified}</p>` : "",
    post.excerpt?.rendered ?? "",
    post.content?.rendered ?? "",
    image ? `<img src="${image}" />` : "",
    "</article>",
  ].join("\n");
}

async function fetchLiveKspStories(source: ReturnType<typeof kspSources>[number]) {
  const tagId = kspTagId(source.slug);
  if (!tagId) return [];
  const postsUrl = `https://wp.kentuckystatepolice.ky.gov/wp-json/wp/v2/posts?tags=${tagId}&per_page=20&_embed=1`;
  const response = await fetchWithTimeout(postsUrl);
  const posts = JSON.parse(response) as KspWordpressPost[];
  return posts
    .filter((post) => post.link)
    .map((post) => parseKspNewsDetail(wordpressDetailHtml(post), source, post.link as string));
}

export async function runOfficialNewsDryRun(options: { fixtures?: boolean; live?: boolean } = {}): Promise<OfficialNewsDryRunResult> {
  const failures: string[] = [];
  const stories: OfficialNewsDryRunStory[] = [];
  const sourceResults: OfficialNewsDryRunSourceResult[] = [];
  const seenCanonicalUrls = new Set<string>();
  const sources = kspSources();
  const useFixtures = options.fixtures || !options.live;

  for (const source of sources) {
    const sourceFailures: string[] = [];
    let discovered = 0;
    let parsed = 0;
    let duplicatesSkipped = 0;

    try {
      if (!useFixtures) {
        const liveStories = await fetchLiveKspStories(source);
        discovered = liveStories.length;
        for (const story of liveStories) {
          const dedupeKey = story.canonicalUrl.toLowerCase();
          if (seenCanonicalUrls.has(dedupeKey)) {
            duplicatesSkipped += 1;
            continue;
          }
          seenCanonicalUrls.add(dedupeKey);
          const article = createOfficialNewsArticleDraft(story);
          stories.push({
            story,
            article,
            wouldCreateFacebookDraft: officialNewsDraftCreationEnabled(),
            wouldAutoPost: officialNewsAutoPostEnabled(),
          });
          parsed += 1;
        }
      } else {
        const listHtml = await readFixture(source.slug === "ksp-post-8-news" ? "post-8-list.html" : "post-9-list.html");
        const items = parseKspNewsList(listHtml, source);
        discovered = items.length;

        for (const item of items) {
          const dedupeKey = item.canonicalUrl.toLowerCase();
          if (seenCanonicalUrls.has(dedupeKey)) {
            duplicatesSkipped += 1;
            continue;
          }
          seenCanonicalUrls.add(dedupeKey);

          const fixtureName = item.canonicalUrl.includes("limited")
            ? "detail-short.html"
            : item.canonicalUrl.includes("without-image")
              ? "detail-without-image.html"
              : "detail-with-image.html";
          const detailHtml = await readFixture(fixtureName);
          const story = parseKspNewsDetail(detailHtml, source, item.canonicalUrl);
          const article = createOfficialNewsArticleDraft(story);
          stories.push({
            story,
            article,
            wouldCreateFacebookDraft: officialNewsDraftCreationEnabled(),
            wouldAutoPost: officialNewsAutoPostEnabled(),
          });
          parsed += 1;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      sourceFailures.push(message);
      failures.push(message);
    }

    sourceResults.push({
      sourceSlug: source.slug,
      sourceName: source.name,
      listUrl: source.listUrl,
      discovered,
      parsed,
      duplicatesSkipped,
      failures: sourceFailures,
    });
  }

  return {
    ok: failures.length === 0,
    dryRun: true,
    importEnabled: officialNewsImportEnabled(),
    autoPostEnabled: officialNewsAutoPostEnabled(),
    stories,
    sources: sourceResults,
    duplicatesSkipped: sourceResults.reduce((sum, source) => sum + source.duplicatesSkipped, 0),
    failures,
  };
}

export async function runOfficialNewsImport(options: { live?: boolean } = {}): Promise<OfficialNewsImportResult | { skipped: true; reason: string }> {
  if (!officialNewsImportEnabled()) {
    return { skipped: true, reason: "OFFICIAL_NEWS_IMPORT_ENABLED and KSP_IMPORT_ENABLED must both be true." };
  }

  const dryRun = await runOfficialNewsDryRun({ live: options.live ?? true, fixtures: false });
  const failures = [...dryRun.failures];
  const stories: OfficialNewsImportResult["stories"] = [];
  let imported = 0;
  let reused = 0;
  let failed = 0;
  let articlesCreatedOrUpdated = 0;
  let facebookDraftsCreatedOrReused = 0;

  await syncOfficialNewsSources();

  for (const entry of dryRun.stories) {
    const source = kspSources().find((candidate) => candidate.slug === entry.story.sourceSlug);
    if (!source) {
      failed += 1;
      failures.push(`No source config found for ${entry.story.sourceSlug}.`);
      continue;
    }

    try {
      const result = await importOfficialNewsStory({ source, story: entry.story });
      if (result.createdStory) imported += 1;
      else reused += 1;
      articlesCreatedOrUpdated += 1;
      if (result.facebookDraftId) facebookDraftsCreatedOrReused += 1;
      stories.push({
        canonicalUrl: entry.story.canonicalUrl,
        title: entry.story.title,
        ...result,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failed += 1;
      failures.push(message);
      stories.push({
        canonicalUrl: entry.story.canonicalUrl,
        title: entry.story.title,
        error: message,
      });
      await logOfficialNewsEvent({
        level: "error",
        event: "story_import_failed",
        message,
        metadata: { canonicalUrl: entry.story.canonicalUrl },
      });
    }
  }

  return {
    ok: failures.length === 0,
    dryRun: false,
    importEnabled: true,
    autoPostEnabled: officialNewsAutoPostEnabled(),
    imported,
    reused,
    failed,
    duplicatesSkipped: dryRun.duplicatesSkipped,
    articlesCreatedOrUpdated,
    facebookDraftsCreatedOrReused,
    stories,
    sources: dryRun.sources,
    failures,
  };
}
