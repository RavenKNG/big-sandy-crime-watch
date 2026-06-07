import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  canonicalizeOfficialNewsUrl,
  createOfficialNewsArticleDraft,
  createOfficialNewsFacebookCaption,
  normalizeOfficialNewsArticleText,
  officialNewsAutoPostEnabled,
  officialNewsDedupeKey,
} from "../src/lib/official-news";
import { parseKspNewsDetail, parseKspNewsList } from "../src/lib/ksp-news-adapter";
import { officialNewsCardData } from "../src/lib/official-news-card";
import { runOfficialNewsDryRun } from "../src/lib/official-news-import";

const source9 = {
  slug: "ksp-post-9-news",
  name: "Kentucky State Police Post 9 News",
  agency: "Kentucky State Police",
  parserKey: "ksp-news" as const,
  sourceType: "state-police-news" as const,
  listUrl: "https://www.kentuckystatepolice.ky.gov/news?tag=post-9",
  attributionLabel: "Kentucky State Police Post 9",
  region: "Post 9 Region",
  enabledEnv: "KSP_IMPORT_ENABLED",
  autoPostEnv: "KSP_AUTO_POST",
  scanIntervalMinutes: 15,
  metadata: { postNumber: 9 },
};

describe("KSP official news foundation", () => {
  it("canonicalizes tracking URLs for dedupe", () => {
    const canonical = canonicalizeOfficialNewsUrl(
      "https://www.kentuckystatepolice.ky.gov/news/example?utm_source=x&fbclid=y",
    );
    expect(canonical).toBe("https://www.kentuckystatepolice.ky.gov/news/example");
    expect(officialNewsDedupeKey(canonical)).toBe(canonical);
  });

  it("parses KSP list pages and skips duplicate canonical URLs", async () => {
    const html = await readFile("fixtures/ksp/post-9-list.html", "utf8");
    const items = parseKspNewsList(html, source9);
    expect(items).toHaveLength(2);
    expect(items[0].postNumber).toBe(9);
    expect(items[0].canonicalUrl).not.toContain("utm_");
  });

  it("extracts detail page metadata including image, county, post, and source text", async () => {
    const html = await readFile("fixtures/ksp/detail-with-image.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-investigation-with-image");
    expect(story.title).toBe("KSP Post 9 Investigating Pike County Incident");
    expect(story.postNumber).toBe(9);
    expect(story.county).toBe("Pike");
    expect(story.officialImageUrl).toBe("https://www.kentuckystatepolice.ky.gov/media/example-ksp-photo.jpg");
    expect(story.sourceTextHash).toHaveLength(64);
  });

  it("does not join duplicate meta excerpts into KSP article source text", async () => {
    const html = await readFile("fixtures/ksp/detail-with-image.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-investigation-with-image");
    const repeatedLead = "Kentucky State Police Post 9 responded to a reported incident in Pike County";
    expect(story.sourceText.match(new RegExp(repeatedLead, "g"))).toHaveLength(1);
  });

  it("creates an original attributed article without copying the full release as the body", async () => {
    const html = await readFile("fixtures/ksp/detail-with-image.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-investigation-with-image");
    const article = createOfficialNewsArticleDraft(story);
    expect(article.sourceName).toBe("Kentucky State Police");
    expect(article.body).not.toContain(story.canonicalUrl);
    expect(article.sourceUrl).toBe(story.canonicalUrl);
    expect(article.body).not.toBe(story.sourceText);
  });

  it("normalizes KSP article text before saving", () => {
    const sourceUrl = "https://kentuckystatepolice.ky.gov/news/example";
    const paragraphs = normalizeOfficialNewsArticleText(
      [
        "According to Kentucky State Police, troopers responded to Floyd County &amp; opened an investigation. [&hellip;]",
        "According to Kentucky State Police, troopers responded to Floyd County & opened an investigation.",
        "Raw source: " + sourceUrl,
        "KSP says additional details may be released as the investigation continues.",
      ].join("\n\n"),
    );
    expect(paragraphs).toHaveLength(2);
    expect(paragraphs[0]).toContain("& opened an investigation.");
    expect(paragraphs.join(" ")).not.toContain("&hellip;");
    expect(paragraphs.join(" ")).not.toContain("[");
    expect(paragraphs.join(" ")).not.toContain(sourceUrl);
    expect(paragraphs.join(" ")).not.toHaveLength(0);
  });

  it("keeps summary wording from being repeated in the article body", () => {
    const summary = "Kentucky State Police says troopers responded to a reported assault in Floyd County.";
    const paragraphs = normalizeOfficialNewsArticleText(
      `${summary}\n${summary}\nAccording to Kentucky State Police, the investigation remains ongoing.`,
      summary,
    );
    expect(paragraphs).toEqual(["According to Kentucky State Police, the investigation remains ongoing."]);
  });

  it("handles short KSP releases as brief notices", async () => {
    const html = await readFile("fixtures/ksp/detail-short.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-limited-release");
    const article = createOfficialNewsArticleDraft(story);
    expect(article.summary.length).toBeGreaterThan(20);
    expect(article.body).toContain("This story is based on information released by KSP Post 9.");
  });

  it("formats Facebook captions with auto-post disabled by default", async () => {
    const html = await readFile("fixtures/ksp/detail-with-image.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-investigation-with-image");
    const caption = createOfficialNewsFacebookCaption(story, "https://bigsandycrimewatch.com/news/example");
    expect(caption).toContain("KSP POST 9 UPDATE");
    expect(caption).toContain("Read more:");
    expect(caption).toContain("Source: Kentucky State Police");
    expect(officialNewsAutoPostEnabled()).toBe(false);
  });

  it("assembles branded image card data without implying KSP ownership", async () => {
    const html = await readFile("fixtures/ksp/detail-with-image.html", "utf8");
    const story = parseKspNewsDetail(html, source9, "/news/ksp-post-9-investigation-with-image");
    const card = officialNewsCardData(story);
    expect(card.label).toBe("KSP POST 9");
    expect(card.sourceLabel).toBe("Source: Kentucky State Police");
    expect(card.watermark).toBe("BigSandyCrimeWatch.com");
    expect(card.locationLabel).toBe("PIKE COUNTY");
  });

  it("runs fixture dry-runs without posting or writing", async () => {
    const result = await runOfficialNewsDryRun({ fixtures: true });
    expect(result.dryRun).toBe(true);
    expect(result.autoPostEnabled).toBe(false);
    expect(result.stories.length).toBeGreaterThanOrEqual(3);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].discovered).toBeGreaterThan(0);
    expect(result.stories.every((entry) => entry.wouldAutoPost === false)).toBe(true);
  });

  it("keeps official-news Facebook drafts out of the due queue unless auto-post flags are enabled", async () => {
    const helper = await readFile("src/lib/official-news-db.ts", "utf8");
    expect(helper).toContain('status: autoPostDraft ? "DRAFTED" : "MANUAL_REQUIRED"');
    expect(helper).toContain("scheduledFor: autoPostDraft ? new Date() : null");
    expect(helper).toContain("KSP_AUTO_POST_MAX_AGE_DAYS");
  });

  it("dedupes DB imports by canonical URL and upserts articles", async () => {
    const helper = await readFile("src/lib/official-news-db.ts", "utf8");
    expect(helper).toContain("where: { canonicalUrl: input.story.canonicalUrl }");
    expect(helper).toContain("db.officialNewsStory.upsert");
    expect(helper).toContain("db.article.upsert");
    expect(helper).toContain("createOfficialNewsFacebookDraft");
  });

  it("registers official-news worker cadence separately from Facebook posting", async () => {
    const runner = await readFile("scripts/automation-runner.ts", "utf8");
    expect(runner).toContain("runOfficialNewsImport");
    expect(runner).toContain('envNum("KSP_SCAN_INTERVAL_MINUTES", 15)');
    expect(runner).toContain("officialNewsIntervalMs");
  });
});
