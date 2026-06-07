import Link from "next/link";
import type { OfficialNewsImportLog, OfficialNewsSource, Prisma } from "@prisma/client";
import { createOfficialNewsDraftAction, regenerateOfficialNewsCard, updateOfficialNewsReviewStatus } from "@/app/actions";
import { officialNewsAutoPostEnabled, officialNewsImportEnabled, officialNewsSources } from "@/lib/official-news";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

type OfficialNewsAdminStory = Prisma.OfficialNewsStoryGetPayload<{
  include: { article: true; assets: true };
}>;

type OfficialNewsAdminData =
  | {
      migrated: true;
      sources: OfficialNewsSource[];
      stories: OfficialNewsAdminStory[];
      logs: OfficialNewsImportLog[];
      error?: never;
    }
  | {
      migrated: false;
      sources: OfficialNewsSource[];
      stories: OfficialNewsAdminStory[];
      logs: OfficialNewsImportLog[];
      error: string;
    };

async function getOfficialNewsAdminData(): Promise<OfficialNewsAdminData> {
  try {
    const db = getDb();
    const [sources, stories, logs] = await Promise.all([
      db.officialNewsSource.findMany({ orderBy: { updatedAt: "desc" } }),
      db.officialNewsStory.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { article: true, assets: true },
      }),
      db.officialNewsImportLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return { migrated: true, sources, stories, logs };
  } catch (error) {
    return {
      migrated: false,
      sources: [],
      stories: [],
      logs: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export default async function OfficialNewsAdminPage() {
  const data = await getOfficialNewsAdminData();

  return (
    <main>
      <p className="eyebrow">OFFICIAL NEWS REVIEW</p>
      <h1>Official news automation</h1>

      <section className="admin-card">
        <h2>Safety state</h2>
        <p>Import enabled: {officialNewsImportEnabled() ? "yes" : "no"}</p>
        <p>Auto-post enabled: {officialNewsAutoPostEnabled() ? "yes" : "no"}</p>
        <p>KSP draft creation flag: {process.env.KSP_CREATE_FACEBOOK_DRAFTS === "false" ? "disabled" : "enabled for drafts only"}</p>
        <p>Admin approval required: {process.env.KSP_REQUIRE_ADMIN_APPROVAL === "true" ? "yes" : "no"}</p>
      </section>

      <section className="admin-card">
        <h2>Configured sources</h2>
        {officialNewsSources.map((source) => (
          <p key={source.slug}>
            <strong>{source.name}</strong> - {source.listUrl} - every {source.scanIntervalMinutes} minutes when enabled
          </p>
        ))}
      </section>

      {!data.migrated ? (
        <section className="admin-card">
          <h2>Database setup pending</h2>
          <p>
            Official-news tracking tables are not available yet. Review the Prisma schema and create/apply the migration before enabling imports.
          </p>
        </section>
      ) : null}

      <section className="admin-card">
        <h2>Imported stories</h2>
        {data.stories.length === 0 ? (
          <p>No official-news stories have been imported.</p>
        ) : (
          data.stories.map((story) => (
            <div className="charge" key={story.id}>
              <h3>{story.title}</h3>
              <p>
                {story.postLabel ?? story.sourceName} - {story.county ?? story.region ?? "region pending"} - {story.importStatus} / {story.reviewStatus}
              </p>
              <p>Canonical URL: <a href={story.canonicalUrl}>{story.canonicalUrl}</a></p>
              <p>Article: {story.article ? <Link href={`/news/${story.article.slug}`}>{story.article.slug}</Link> : "not created"}</p>
              <p>Facebook draft: {story.facebookDraftId ?? "not created"} - post status: {story.postStatus}</p>
              <p>Images: horizontal {story.cardImageHorizontalUrl ? "ready" : "missing"}, vertical {story.cardImageVerticalUrl ? "ready" : "missing"}</p>
              {story.errorMessage ? <p className="notice">{story.errorMessage}</p> : null}
              <div className="button-row">
                <a className="button" href={story.canonicalUrl}>View source</a>
                {story.article ? <Link className="button" href={`/news/${story.article.slug}`}>View article</Link> : null}
              </div>
              <form action={updateOfficialNewsReviewStatus}>
                <input type="hidden" name="id" value={story.id} />
                <label>
                  Review status
                  <select name="reviewStatus" defaultValue={story.reviewStatus}>
                    <option value="PENDING">PENDING</option>
                    <option value="REVIEWED">REVIEWED</option>
                    <option value="HOLD">HOLD</option>
                  </select>
                </label>
                <button type="submit">Update review</button>
              </form>
              <form action={regenerateOfficialNewsCard}>
                <input type="hidden" name="id" value={story.id} />
                <button type="submit">Regenerate card</button>
              </form>
              {!story.facebookDraftId && story.article ? (
                <form action={createOfficialNewsDraftAction}>
                  <input type="hidden" name="id" value={story.id} />
                  <button type="submit">Create Facebook draft</button>
                </form>
              ) : null}
            </div>
          ))
        )}
      </section>

      <section className="admin-card">
        <h2>Recent logs</h2>
        {data.logs.length === 0 ? (
          <p>No official-news logs have been recorded.</p>
        ) : (
          data.logs.map((log) => (
            <p key={log.id}>
              {log.createdAt.toISOString()} - {log.level} - {log.event}: {log.message}
            </p>
          ))
        )}
      </section>
    </main>
  );
}
