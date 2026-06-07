import { getDb } from "./db";
import type { Prisma } from "@prisma/client";
import { generateOfficialNewsCards } from "./official-news-card";
import {
  createOfficialNewsArticleDraft,
  createOfficialNewsFacebookCaption,
  officialNewsAutoPostEnabled,
  officialNewsDraftCreationEnabled,
  officialNewsSources,
  type OfficialNewsArticleDraft,
  type OfficialNewsSourceConfig,
  type ParsedOfficialNewsStory,
} from "./official-news";

type DbClient = ReturnType<typeof getDb>;

function siteUrl() {
  return (process.env.SITE_URL || "https://bigsandycrimewatch.com").replace(/\/$/, "");
}

function requireAdminApproval() {
  return process.env.KSP_REQUIRE_ADMIN_APPROVAL === "true";
}

function generateImageCardsEnabled() {
  return process.env.KSP_GENERATE_IMAGE_CARDS !== "false";
}

function autoPostMaxAgeDays() {
  const parsed = Number.parseFloat(process.env.KSP_AUTO_POST_MAX_AGE_DAYS || "7");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

function eligibleForAutoPost(story: ParsedOfficialNewsStory) {
  if (!officialNewsAutoPostEnabled()) return false;
  if (!story.publishedAt) return true;
  const maxAgeMs = autoPostMaxAgeDays() * 24 * 60 * 60 * 1000;
  return Date.now() - story.publishedAt.getTime() <= maxAgeMs;
}

async function logOfficialNewsEvent(input: {
  db?: DbClient;
  sourceId?: string | null;
  storyId?: string | null;
  level: "info" | "warn" | "error";
  event: string;
  message: string;
  metadata?: Prisma.InputJsonValue;
}) {
  const db = input.db ?? getDb();
  try {
    await db.officialNewsImportLog.create({
      data: {
        sourceId: input.sourceId ?? null,
        storyId: input.storyId ?? null,
        level: input.level,
        event: input.event,
        message: input.message,
        metadata: input.metadata,
      },
    });
  } catch {
    // Logging should never break an import.
  }
}

export async function upsertOfficialNewsSourceConfig(source: OfficialNewsSourceConfig) {
  const db = getDb();
  const enabled = process.env.OFFICIAL_NEWS_IMPORT_ENABLED === "true" && process.env[source.enabledEnv] === "true";
  const autoPostEnabled = officialNewsAutoPostEnabled() && process.env[source.autoPostEnv] === "true";
  return db.officialNewsSource.upsert({
    where: { slug: source.slug },
    update: {
      name: source.name,
      agency: source.agency,
      sourceType: source.sourceType,
      listUrl: source.listUrl,
      enabled,
      autoPostEnabled,
      scanIntervalMinutes: source.scanIntervalMinutes,
      attributionLabel: source.attributionLabel,
      region: source.region,
      parserKey: source.parserKey,
    },
    create: {
      slug: source.slug,
      name: source.name,
      agency: source.agency,
      sourceType: source.sourceType,
      baseUrl: new URL(source.listUrl).origin,
      listUrl: source.listUrl,
      enabled,
      autoPostEnabled,
      scanIntervalMinutes: source.scanIntervalMinutes,
      attributionLabel: source.attributionLabel,
      region: source.region,
      parserKey: source.parserKey,
    },
  });
}

export async function syncOfficialNewsSources() {
  return Promise.all(officialNewsSources.map((source) => upsertOfficialNewsSourceConfig(source)));
}

export function officialNewsArticleUrl(article: OfficialNewsArticleDraft) {
  return `${siteUrl()}/news/${article.slug}`;
}

export async function createOfficialNewsArticle(story: ParsedOfficialNewsStory, heroImageUrl?: string | null) {
  const db = getDb();
  const article = createOfficialNewsArticleDraft(story);
  const status = requireAdminApproval() ? "REVIEW" : "PUBLISHED";
  const publishedAt = status === "PUBLISHED" ? (story.publishedAt ?? new Date()) : null;
  return db.article.upsert({
    where: { slug: article.slug },
    update: {
      title: article.title,
      summary: article.summary,
      body: article.body,
      category: article.category,
      county: article.county,
      sourceName: article.sourceName,
      sourceUrl: article.sourceUrl,
      sourcePublishedAt: article.sourcePublishedAt,
      heroImageUrl,
      status,
      publishedAt,
    },
    create: {
      ...article,
      heroImageUrl,
      status,
      publishedAt,
    },
  });
}

export async function createOfficialNewsFacebookDraft(story: ParsedOfficialNewsStory, article: { id: string; slug: string }) {
  if (!officialNewsDraftCreationEnabled()) {
    return { created: false, skipped: true, reason: "KSP_CREATE_FACEBOOK_DRAFTS=false" };
  }

  const db = getDb();
  const existing = await db.facebookDraft.findFirst({ where: { articleId: article.id } });
  if (existing) return { created: false, id: existing.id, status: existing.status };

  const articleDraft = createOfficialNewsArticleDraft(story);
  const postUrl = officialNewsArticleUrl({ ...articleDraft, slug: article.slug });
  const autoPostDraft = eligibleForAutoPost(story);
  const draft = await db.facebookDraft.create({
    data: {
      articleId: article.id,
      status: autoPostDraft ? "DRAFTED" : "MANUAL_REQUIRED",
      scheduledFor: autoPostDraft ? new Date() : null,
      postText: createOfficialNewsFacebookCaption(story, postUrl),
      postUrl,
      imageUrl: story.officialImageUrl ?? null,
      errorMessage: autoPostDraft
        ? null
        : JSON.stringify({
            notice: officialNewsAutoPostEnabled()
              ? "Official news draft held for manual review because the source item is older than the auto-post age window."
              : "Official news auto-posting is disabled by environment flags.",
          }),
    },
  });

  return { created: true, id: draft.id, status: draft.status };
}

async function createOfficialNewsAssets(storyId: string, story: ParsedOfficialNewsStory) {
  if (!generateImageCardsEnabled()) {
    return {
      horizontalPath: null,
      verticalPath: null,
      skipped: true,
    };
  }

  const db = getDb();
  const existingHorizontal = await db.officialNewsGeneratedAsset.findFirst({
    where: { storyId, assetType: "CARD_1200x630", status: "READY" },
  });
  const existingVertical = await db.officialNewsGeneratedAsset.findFirst({
    where: { storyId, assetType: "CARD_1080x1920", status: "READY" },
  });
  if (existingHorizontal?.publicUrl && existingVertical?.publicUrl) {
    return {
      horizontalPath: existingHorizontal.publicUrl as string,
      verticalPath: existingVertical.publicUrl as string,
      reused: true,
    };
  }

  const cards = await generateOfficialNewsCards(story);
  await Promise.all([
    db.officialNewsGeneratedAsset.upsert({
      where: { id: existingHorizontal?.id ?? "__missing_horizontal__" },
      update: { publicUrl: cards.horizontalPath, width: 1200, height: 630, status: "READY", errorMessage: null },
      create: {
        storyId,
        assetType: "CARD_1200x630",
        publicUrl: cards.horizontalPath,
        width: 1200,
        height: 630,
        status: "READY",
      },
    }).catch(() =>
      db.officialNewsGeneratedAsset.create({
        data: {
          storyId,
          assetType: "CARD_1200x630",
          publicUrl: cards.horizontalPath,
          width: 1200,
          height: 630,
          status: "READY",
        },
      }),
    ),
    db.officialNewsGeneratedAsset.upsert({
      where: { id: existingVertical?.id ?? "__missing_vertical__" },
      update: { publicUrl: cards.verticalPath, width: 1080, height: 1920, status: "READY", errorMessage: null },
      create: {
        storyId,
        assetType: "CARD_1080x1920",
        publicUrl: cards.verticalPath,
        width: 1080,
        height: 1920,
        status: "READY",
      },
    }).catch(() =>
      db.officialNewsGeneratedAsset.create({
        data: {
          storyId,
          assetType: "CARD_1080x1920",
          publicUrl: cards.verticalPath,
          width: 1080,
          height: 1920,
          status: "READY",
        },
      }),
    ),
  ]);

  return cards;
}

export async function importOfficialNewsStory(input: {
  source: OfficialNewsSourceConfig;
  story: ParsedOfficialNewsStory;
}) {
  const db = getDb();
  const source = await upsertOfficialNewsSourceConfig(input.source);
  const articleDraft = createOfficialNewsArticleDraft(input.story);
  const existing = await db.officialNewsStory.findUnique({
    where: { canonicalUrl: input.story.canonicalUrl },
    include: { article: true },
  });

  const storyRecord = await db.officialNewsStory.upsert({
    where: { canonicalUrl: input.story.canonicalUrl },
    update: {
      title: input.story.title,
      slug: articleDraft.slug,
      summary: articleDraft.summary,
      generatedArticleBody: articleDraft.body,
      sourceTextHash: input.story.sourceTextHash,
      publishedAt: input.story.publishedAt,
      updatedSourceAt: input.story.updatedAt,
      county: input.story.county,
      city: input.story.city,
      region: input.story.region,
      officialImageUrl: input.story.officialImageUrl,
      importStatus: "IMPORTED",
      errorMessage: null,
      metadata: {
        postNumber: input.story.postNumber,
        authorLabel: input.story.authorLabel,
        tags: input.story.tags,
      },
    },
    create: {
      sourceId: source.id,
      canonicalUrl: input.story.canonicalUrl,
      sourceUrl: input.story.sourceUrl,
      sourceName: input.story.sourceName,
      agency: input.story.agency,
      postLabel: input.story.postLabel,
      title: input.story.title,
      slug: articleDraft.slug,
      summary: articleDraft.summary,
      generatedArticleBody: articleDraft.body,
      sourceTextHash: input.story.sourceTextHash,
      publishedAt: input.story.publishedAt,
      updatedSourceAt: input.story.updatedAt,
      importedAt: new Date(),
      county: input.story.county,
      city: input.story.city,
      region: input.story.region,
      officialImageUrl: input.story.officialImageUrl,
      importStatus: "IMPORTED",
      reviewStatus: requireAdminApproval() ? "PENDING" : "REVIEWED",
      postStatus: "NOT_QUEUED",
      metadata: {
        postNumber: input.story.postNumber,
        authorLabel: input.story.authorLabel,
        tags: input.story.tags,
      },
    },
  });

  const assets = await createOfficialNewsAssets(storyRecord.id, input.story);
  const heroImageUrl = input.story.officialImageUrl ?? assets.horizontalPath ?? null;
  const facebookImageUrl = assets.horizontalPath ?? input.story.officialImageUrl ?? null;
  const article = await createOfficialNewsArticle(input.story, heroImageUrl);
  const facebookDraft = await createOfficialNewsFacebookDraft(
    {
      ...input.story,
      officialImageUrl: facebookImageUrl ?? undefined,
    },
    article,
  );

  await db.officialNewsStory.update({
    where: { id: storyRecord.id },
    data: {
      articleId: article.id,
      heroImageUrl,
      cardImageHorizontalUrl: assets.horizontalPath,
      cardImageVerticalUrl: assets.verticalPath,
      facebookDraftId: facebookDraft.id ?? existing?.facebookDraftId ?? null,
      postStatus: facebookDraft.id ? facebookDraft.status : "NOT_QUEUED",
    },
  });

  await logOfficialNewsEvent({
    db,
    sourceId: source.id,
    storyId: storyRecord.id,
    level: "info",
    event: existing ? "story_reused" : "story_imported",
    message: existing ? "Official news story already existed and was updated." : "Official news story imported.",
    metadata: {
      canonicalUrl: input.story.canonicalUrl,
      articleId: article.id,
      facebookDraftId: facebookDraft.id,
    },
  });

  return {
    storyId: storyRecord.id,
    articleId: article.id,
    facebookDraftId: facebookDraft.id ?? null,
    createdStory: !existing,
    articleSlug: article.slug,
    heroImageUrl,
    cardImageHorizontalUrl: assets.horizontalPath,
    cardImageVerticalUrl: assets.verticalPath,
  };
}

export { logOfficialNewsEvent };
