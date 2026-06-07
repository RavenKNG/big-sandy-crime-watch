import { runOfficialNewsDryRun, runOfficialNewsImport } from "../src/lib/official-news-import";

async function main() {
  const live = process.argv.includes("--live");
  const confirmed = process.argv.includes("--confirm");
  const dryRun = !confirmed;

  if (!dryRun) {
    const result = await runOfficialNewsImport({ live: true });
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const result = await runOfficialNewsDryRun({ live, fixtures: !live });
  console.log(
    JSON.stringify(
      {
        ...result,
        sources: result.sources,
        duplicatesSkipped: result.duplicatesSkipped,
        stories: result.stories.map((entry) => ({
          canonicalUrl: entry.story.canonicalUrl,
          source: entry.story.sourceName,
          postLabel: entry.story.postLabel,
          title: entry.story.title,
          county: entry.story.county,
          city: entry.story.city,
          publishedAt: entry.story.publishedAt?.toISOString() ?? null,
          officialImageUrl: entry.story.officialImageUrl ?? null,
          articleSlug: entry.article.slug,
          articleSummary: entry.article.summary,
          wouldCreateFacebookDraft: entry.wouldCreateFacebookDraft,
          wouldAutoPost: entry.wouldAutoPost,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      null,
      2,
    ),
  );
  process.exit(1);
});
