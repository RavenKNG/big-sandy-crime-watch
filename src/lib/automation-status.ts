import { getDb } from "./db";
import { getRowanPromoStatus } from "./rowan-promo-runtime";

type QueueCountRow = {
  status: string;
  _count: {
    _all: number;
  };
};

function queueCountMap(rows: QueueCountRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = row._count._all;
    return acc;
  }, {});
}

export async function getAutomationStatusSnapshot() {
  const db = getDb();
  const [
    latestRecord,
    latestPublishedRecord,
    latestDraft,
    latestPostedDraft,
    queueCounts,
    connection,
    rowanPromo,
  ] = await Promise.all([
    db.publicRecordDemo.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        slug: true,
        createdAt: true,
        sourceTimestamp: true,
        publishStatus: true,
        facebookPostStatus: true,
      },
    }),
    db.publicRecordDemo.findFirst({
      where: { publishStatus: { in: ["APPROVED", "PUBLISHED"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        slug: true,
        createdAt: true,
        updatedAt: true,
        facebookPostStatus: true,
      },
    }),
    db.facebookDraft.findFirst({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        postUrl: true,
      },
    }),
    db.facebookDraft.findFirst({
      where: { status: "POSTED" },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        updatedAt: true,
        facebookPostId: true,
        postUrl: true,
      },
    }),
    db.facebookDraft.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.facebookConnection.findUnique({
      where: { id: "primary" },
      select: {
        pageName: true,
        pageId: true,
        tokenStatus: true,
        tokenExpiresAt: true,
        dataAccessExpiresAt: true,
        lastHealthCheckAt: true,
        lastSuccessfulPostAt: true,
        lastFacebookError: true,
        updatedAt: true,
      },
    }).catch(() => null),
    getRowanPromoStatus().catch(() => ({
      enabled: process.env.ROWAN_PROMO_ENABLED === "true",
      pageUrl: "https://bigsandycrimewatch.com/county/rowan",
      alreadyQueued: false,
      lastQueuedAt: null,
      lastPostedAt: null,
      nextEligibleAt: null,
      lastPostId: null,
    })),
  ]);

  const counts = queueCountMap(queueCounts);
  const postingEnabled = process.env.FACEBOOK_POSTING_ENABLED === "true";
  const queueBacklog = (counts.DRAFTED ?? 0) + (counts.QUEUED ?? 0);
  const failedCount = counts.FAILED ?? 0;
  const warnings: string[] = [];

  if (!postingEnabled) warnings.push("Facebook posting is disabled.");
  if (!connection) warnings.push("No stored Facebook connection row is present.");
  if (connection?.tokenStatus && connection.tokenStatus !== "HEALTHY") {
    warnings.push(`Facebook token status is ${connection.tokenStatus}.`);
  }
  if (queueBacklog > 0 && connection?.tokenStatus !== "HEALTHY") {
    warnings.push(`Facebook queue backlog is ${queueBacklog} while connection is unhealthy.`);
  }
  if (failedCount > 0) warnings.push(`${failedCount} Facebook draft${failedCount === 1 ? "" : "s"} failed.`);
  if (postingEnabled && connection?.lastSuccessfulPostAt) {
    const hoursSincePost = (Date.now() - connection.lastSuccessfulPostAt.getTime()) / (1000 * 60 * 60);
    const expectedIntervalHours = Number.parseFloat(process.env.POST_INTERVAL_HOURS || "3");
    if (hoursSincePost > expectedIntervalHours * 2) {
      warnings.push(`No successful Facebook post in ${hoursSincePost.toFixed(1)} hours.`);
    }
  }

  return {
    postingEnabled,
    testPostingEnabled: process.env.FACEBOOK_TEST_POST_ENABLED === "true",
    postIntervalHours: Number.parseFloat(process.env.POST_INTERVAL_HOURS || "3"),
    latestRecord,
    latestPublishedRecord,
    latestDraft,
    latestPostedDraft,
    queueCounts: {
      drafted: counts.DRAFTED ?? 0,
      queued: counts.QUEUED ?? 0,
      posted: counts.POSTED ?? 0,
      failed: counts.FAILED ?? 0,
      manualRequired: counts.MANUAL_REQUIRED ?? 0,
      notQueued: counts.NOT_QUEUED ?? 0,
    },
    rowanPromo,
    connection,
    warnings,
  };
}
