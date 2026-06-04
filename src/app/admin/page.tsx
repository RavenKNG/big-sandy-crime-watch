import Link from "next/link";
import { updateCorrectionStatus } from "@/app/actions";
import { getAutomationStatusSnapshot } from "@/lib/automation-status";
import { getDb } from "@/lib/db";
import { last72HoursBounds, todayBounds } from "@/lib/record-display";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const db = getDb();
  const today = todayBounds();
  const recent = last72HoursBounds();
  const [records, corrections, sponsorCount, published, todayCount, recentCount, queued, failed, nextPost, recentPosts, automation] =
    await Promise.all([
      db.publicRecordDemo.findMany({ orderBy: { createdAt: "desc" }, take: 25 }),
      db.correctionRequest.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      db.sponsorAd.count(),
      db.publicRecordDemo.count({ where: { publishStatus: "PUBLISHED" } }),
      db.publicRecordDemo.count({ where: { publishStatus: "PUBLISHED", bookingDate: { gte: today.start, lt: today.end } } }),
      db.publicRecordDemo.count({ where: { publishStatus: "PUBLISHED", bookingDate: { gte: recent.start, lt: recent.end } } }),
      db.facebookDraft.count({ where: { status: "DRAFTED" } }),
      db.facebookDraft.count({ where: { status: "FAILED" } }),
      db.facebookDraft.findFirst({ where: { status: "DRAFTED" }, orderBy: { scheduledFor: "asc" }, select: { scheduledFor: true } }),
      db.facebookDraft.findMany({ where: { status: "POSTED" }, orderBy: { updatedAt: "desc" }, take: 3, select: { facebookPostId: true } }),
      getAutomationStatusSnapshot(),
    ]);
  const drafts = records.filter(
    (record: (typeof records)[number]) => record.publishStatus === "DRAFT",
  ).length;

  return (
    <main>
      <p className="eyebrow">EDITORIAL CONTROL ROOM</p>
      <h1>Admin dashboard</h1>

      {automation.warnings.length > 0 ? (
        <section className="admin-card">
          <h2>Automation warnings</h2>
          {automation.warnings.map((warning: (typeof automation.warnings)[number]) => (
            <p className="notice" key={warning}>{warning}</p>
          ))}
          <p>Last Facebook health check: {automation.connection?.lastHealthCheckAt?.toISOString() ?? "not checked"}</p>
          <p>Last successful Facebook post: {automation.connection?.lastSuccessfulPostAt?.toISOString() ?? "none"}</p>
          <p>Latest imported/public record: {automation.latestRecord?.slug ?? "none"} ({automation.latestRecord?.createdAt?.toISOString() ?? "unknown"})</p>
        </section>
      ) : null}

      <div className="admin-grid">
        <section className="admin-card"><h2>{todayCount}</h2><p>Published records today.</p></section>
        <section className="admin-card"><h2>{recentCount}</h2><p>Published records in the last 72 hours.</p></section>
        <section className="admin-card"><h2>{published}</h2><p>Total published records.</p></section>
        <section className="admin-card"><h2>{queued}</h2><p>Queued Facebook drafts.</p></section>
        <section className="admin-card"><h2>{failed}</h2><p>Failed Facebook drafts.</p></section>
        <section className="admin-card"><h2>{drafts}</h2><p>Editorial drafts awaiting review.</p><Link className="button" href="/admin/manual-entry">Create draft</Link></section>
        <section className="admin-card"><h2>{sponsorCount}</h2><p>Configured sponsor slots.</p><Link className="button" href="/admin/sponsors">Sponsor setup</Link></section>
      </div>

      <section className="admin-card">
        <h2>Facebook connection</h2>
        <p>Reconnect, review token health, and inspect redacted status from the protected connection page.</p>
        <p>Token status: {automation.connection?.tokenStatus ?? "unknown"}</p>
        <p>Posting enabled: {automation.postingEnabled ? "yes" : "no"}</p>
        <p>Test posting enabled: {automation.testPostingEnabled ? "yes" : "no"}</p>
        <Link className="button" href="/admin/facebook/connect">Open Facebook connection</Link>
      </section>

      <section className="admin-card">
        <h2>Automation snapshot</h2>
        <p>Next queued post: {nextPost?.scheduledFor?.toISOString() ?? "none"}</p>
        <p>
          Recent Facebook post IDs: {recentPosts
            .map((post: (typeof recentPosts)[number]) => post.facebookPostId)
            .filter(Boolean)
            .join(", ") || "none"}
        </p>
        <p>Latest published record: {automation.latestPublishedRecord?.slug ?? "none"}</p>
        <p>Latest Facebook draft: {automation.latestDraft?.createdAt?.toISOString() ?? "none"}</p>
        <Link className="button" href="/admin/facebook-export">Open export queue</Link>
      </section>

      <section className="admin-card">
        <h2>Rowan promo</h2>
        <p>Enabled: {automation.rowanPromo.enabled ? "yes" : "no"}</p>
        <p>Already queued: {automation.rowanPromo.alreadyQueued ? "yes" : "no"}</p>
        <p>Last queued: {automation.rowanPromo.lastQueuedAt?.toISOString() ?? "never"}</p>
        <p>Last posted: {automation.rowanPromo.lastPostedAt?.toISOString() ?? "never"}</p>
        <p>Next eligible: {automation.rowanPromo.nextEligibleAt?.toISOString() ?? "unknown"}</p>
        <p>
          Landing page: <Link href="/county/rowan">/county/rowan</Link>
        </p>
      </section>

      <h2>Saved records</h2>
      {records.map((record: (typeof records)[number]) => <p key={record.id}><Link href={`/admin/records/${record.slug}`}>{record.displayName}</Link> - {record.publishStatus}</p>)}

      <h2>Correction requests</h2>
      <p className="notice">Correction-request email notifications are disabled. Review this queue manually.</p>
      {corrections.length === 0 ? <p>No requests submitted.</p> : corrections.map((request: (typeof corrections)[number]) => <section className="admin-card" key={request.id}><strong>{request.requestType} - {request.status}</strong><p>{request.name} - {request.email}</p><p>Submitted: {request.createdAt.toISOString()}</p>{request.relatedUrl && <p><a href={request.relatedUrl}>Open related record</a></p>}<p>{request.message}</p><form action={updateCorrectionStatus}><input type="hidden" name="id" value={request.id}/><label>Review status<select name="status" defaultValue={request.status}><option>NEW</option><option>REVIEWING</option><option>RESOLVED</option><option>DENIED</option></select></label><button type="submit">Update request</button></form></section>)}
    </main>
  );
}
