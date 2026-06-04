import { getDb } from "./db";
import { verifyFacebookPageToken } from "./facebook-token-health";
import {
  createRowanPromoCaption,
  evaluateRowanPromoEligibility,
  rowanLandingUrl,
  rowanPromoDraftMeta,
} from "./rowan-promo";

async function rowanPageAvailable(siteUrl: string) {
  try {
    const response = await fetch(rowanLandingUrl(siteUrl), {
      method: "GET",
      headers: { Accept: "text/html" },
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function getRowanPromoStatus(siteUrl = process.env.SITE_URL || "https://bigsandycrimewatch.com") {
  const db = getDb();
  const landingUrl = rowanLandingUrl(siteUrl);
  const [queued, posted] = await Promise.all([
    db.facebookDraft.findFirst({
      where: {
        postUrl: landingUrl,
        status: { in: ["DRAFTED", "QUEUED"] },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, scheduledFor: true, status: true },
    }),
    db.facebookDraft.findFirst({
      where: {
        postUrl: landingUrl,
        status: "POSTED",
      },
      orderBy: { updatedAt: "desc" },
      select: { id: true, updatedAt: true, facebookPostId: true },
    }),
  ]);

  const nextEligibleAt = posted
    ? new Date(posted.updatedAt.getTime() + 72 * 60 * 60 * 1000)
    : new Date();

  return {
    enabled: process.env.ROWAN_PROMO_ENABLED === "true",
    pageUrl: landingUrl,
    alreadyQueued: Boolean(queued),
    lastQueuedAt: queued?.createdAt ?? null,
    lastPostedAt: posted?.updatedAt ?? null,
    nextEligibleAt,
    lastPostId: posted?.facebookPostId ?? null,
  };
}

export async function queueRowanPromoDraft({
  force = false,
  siteUrl = process.env.SITE_URL || "https://bigsandycrimewatch.com",
}: {
  force?: boolean;
  siteUrl?: string;
} = {}) {
  const db = getDb();
  const landingUrl = rowanLandingUrl(siteUrl);
  const [status, facebookHealth] = await Promise.all([
    getRowanPromoStatus(siteUrl),
    verifyFacebookPageToken(),
  ]);
  const pageExists = await rowanPageAvailable(siteUrl);

  const eligibility = evaluateRowanPromoEligibility({
    enabled: force ? true : process.env.ROWAN_PROMO_ENABLED === "true",
    pageExists,
    facebookHealthy: facebookHealth.healthy,
    postingEnabled: process.env.FACEBOOK_POSTING_ENABLED === "true",
    queuedExists: status.alreadyQueued,
    lastPostedAt: status.lastPostedAt,
  });

  if (!eligibility.eligible) {
    return {
      queued: false,
      reason: eligibility.reason,
      nextEligibleAt: eligibility.nextEligibleAt,
    };
  }

  const draftCount = await db.facebookDraft.count({
    where: {
      postUrl: landingUrl,
    },
  });

  const meta = rowanPromoDraftMeta(siteUrl);
  const draft = await db.facebookDraft.create({
    data: {
      status: "DRAFTED",
      scheduledFor: new Date(),
      postText: createRowanPromoCaption(draftCount, siteUrl),
      postUrl: landingUrl,
      imageUrl: null,
      errorMessage: JSON.stringify(meta),
    },
  });

  return {
    queued: true,
    draftId: draft.id,
    nextEligibleAt: eligibility.nextEligibleAt,
  };
}
