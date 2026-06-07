import type { FacebookStatus, PublishStatus } from "@prisma/client";
import { getDb } from "./db";
import { createFacebookRecordDraftPayload } from "./facebook-record-drafts";
import { publishedRecordOrder } from "./record-display";

type DraftLike = {
  id: string;
  status: FacebookStatus | string;
  scheduledFor?: Date | null;
  facebookPostId?: string | null;
  errorMessage?: string | null;
};

export type FacebookDraftGapRecord = {
  id: string;
  slug: string;
  displayName: string;
  publishStatus: PublishStatus | string;
  facebookPostStatus: FacebookStatus | string;
  createdAt: Date;
  updatedAt: Date;
  facebookDrafts: DraftLike[];
};

export type FacebookDraftGapClassification = {
  recordId: string;
  slug: string;
  displayName: string;
  publishStatus: string;
  facebookPostStatus: string;
  draftCount: number;
  failedDraftCount: number;
  manualRequiredDraftCount: number;
  hasActiveDraft: boolean;
  hasValidPostedDraft: boolean;
  missingDraft: boolean;
  invalidPostedState: boolean;
  needsRepair: boolean;
  autoCreateEligible: boolean;
  reason: string | null;
};

function hasPostId(draft: DraftLike) {
  return typeof draft.facebookPostId === "string" && draft.facebookPostId.trim().length > 0;
}

function draftIsActive(draft: DraftLike) {
  return draft.status === "DRAFTED" || draft.status === "QUEUED";
}

export function classifyFacebookDraftGap(record: FacebookDraftGapRecord): FacebookDraftGapClassification {
  const drafts = record.facebookDrafts;
  const hasActiveDraft = drafts.some(draftIsActive);
  const hasValidPostedDraft = drafts.some((draft) => draft.status === "POSTED" && hasPostId(draft));
  const failedDraftCount = drafts.filter((draft) => draft.status === "FAILED").length;
  const manualRequiredDraftCount = drafts.filter((draft) => draft.status === "MANUAL_REQUIRED").length;
  const missingDraft = drafts.length === 0;
  const invalidPostedState = record.facebookPostStatus === "POSTED" && !hasValidPostedDraft;
  const published = record.publishStatus === "PUBLISHED";
  const needsRepair = published && !hasValidPostedDraft && !hasActiveDraft;
  const hasBlockedDraft = failedDraftCount > 0 || manualRequiredDraftCount > 0;
  const autoCreateEligible = needsRepair && !hasBlockedDraft && (missingDraft || invalidPostedState);

  let reason: string | null = null;
  if (needsRepair) {
    if (missingDraft) reason = "missing_facebook_draft";
    else if (invalidPostedState) reason = "posted_without_valid_facebook_post_id";
    else if (failedDraftCount > 0) reason = "failed_draft_requires_review";
    else if (manualRequiredDraftCount > 0) reason = "manual_required_draft_requires_review";
    else reason = "no_active_or_valid_posted_draft";
  }

  return {
    recordId: record.id,
    slug: record.slug,
    displayName: record.displayName,
    publishStatus: String(record.publishStatus),
    facebookPostStatus: String(record.facebookPostStatus),
    draftCount: drafts.length,
    failedDraftCount,
    manualRequiredDraftCount,
    hasActiveDraft,
    hasValidPostedDraft,
    missingDraft,
    invalidPostedState,
    needsRepair,
    autoCreateEligible,
    reason,
  };
}

function positiveNumber(value: number | undefined, fallback: number) {
  return Number.isFinite(value) && value && value > 0 ? value : fallback;
}

export async function getFacebookDraftGapSummary(options: { windowHours?: number; take?: number } = {}) {
  const db = getDb();
  const windowHours = positiveNumber(options.windowHours, 72);
  const take = Math.max(1, Math.trunc(positiveNumber(options.take, 200)));
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000);

  const records = await db.publicRecordDemo.findMany({
    where: {
      publishStatus: "PUBLISHED",
      OR: [
        { createdAt: { gte: since } },
        { updatedAt: { gte: since } },
        { bookingDate: { gte: since } },
      ],
    },
    include: {
      facebookDrafts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          facebookPostId: true,
          errorMessage: true,
        },
      },
    },
    orderBy: publishedRecordOrder,
    take,
  });

  const classifications = records.map(classifyFacebookDraftGap);
  const missingDrafts = classifications.filter((record) => record.needsRepair && record.missingDraft);
  const invalidPosted = classifications.filter((record) => record.invalidPostedState);
  const failedOrManual = classifications.filter(
    (record) => record.needsRepair && (record.failedDraftCount > 0 || record.manualRequiredDraftCount > 0),
  );
  const needsRepair = classifications.filter((record) => record.needsRepair);
  const autoCreateEligible = classifications.filter((record) => record.autoCreateEligible);

  return {
    checkedAt: new Date(),
    windowHours,
    publicRecordsChecked: records.length,
    missingDraftCount: missingDrafts.length,
    invalidPostedCount: invalidPosted.length,
    failedOrManualDraftCount: failedOrManual.length,
    needsRepairCount: needsRepair.length,
    autoCreateEligibleCount: autoCreateEligible.length,
    samples: needsRepair.slice(0, 10),
  };
}

export async function repairMissingFacebookDrafts(
  options: { windowHours?: number; maxCreate?: number; dryRun?: boolean; now?: Date } = {},
) {
  const db = getDb();
  const windowHours = positiveNumber(options.windowHours, 72);
  const maxCreate = Math.max(0, Math.trunc(positiveNumber(options.maxCreate, 25)));
  const now = options.now ?? new Date();
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000);
  const intervalHours = positiveNumber(Number.parseFloat(process.env.POST_INTERVAL_HOURS || "3"), 3);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  const records = await db.publicRecordDemo.findMany({
    where: {
      publishStatus: "PUBLISHED",
      OR: [
        { createdAt: { gte: since } },
        { updatedAt: { gte: since } },
        { bookingDate: { gte: since } },
      ],
    },
    include: {
      charges: { orderBy: { displayOrder: "asc" } },
      facebookDrafts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          scheduledFor: true,
          facebookPostId: true,
          errorMessage: true,
        },
      },
    },
    orderBy: publishedRecordOrder,
    take: 200,
  });

  const candidates = records
    .map((record) => ({ record, classification: classifyFacebookDraftGap(record) }))
    .filter((item) => item.classification.autoCreateEligible)
    .slice(0, maxCreate);

  const created: Array<{
    recordId: string;
    slug: string;
    displayName: string;
    draftId: string;
    scheduledFor: Date;
    reason: string | null;
  }> = [];
  const skipped: Array<{
    recordId: string;
    slug: string;
    displayName: string;
    reason: string | null;
  }> = [];

  if (options.dryRun) {
    return {
      dryRun: true,
      windowHours,
      maxCreate,
      intervalHours,
      candidates: candidates.map((item) => item.classification),
      created,
      skipped,
    };
  }

  for (const item of candidates) {
    const freshDrafts = await db.facebookDraft.findMany({
      where: { recordId: item.record.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        scheduledFor: true,
        facebookPostId: true,
        errorMessage: true,
      },
    });
    const freshClassification = classifyFacebookDraftGap({
      ...item.record,
      facebookDrafts: freshDrafts,
    });

    if (!freshClassification.autoCreateEligible) {
      skipped.push({
        recordId: item.record.id,
        slug: item.record.slug,
        displayName: item.record.displayName,
        reason: freshClassification.reason ?? "fresh_check_no_longer_eligible",
      });
      continue;
    }

    const scheduledFor = new Date(now.getTime() + created.length * intervalMs);
    const draftPayload = await createFacebookRecordDraftPayload(item.record, process.env.SITE_URL);
    const draft = await db.facebookDraft.create({
      data: {
        recordId: item.record.id,
        status: "DRAFTED",
        scheduledFor,
        ...draftPayload,
      },
    });
    await db.publicRecordDemo.update({
      where: { id: item.record.id },
      data: { facebookPostStatus: "DRAFTED" },
    });
    created.push({
      recordId: item.record.id,
      slug: item.record.slug,
      displayName: item.record.displayName,
      draftId: draft.id,
      scheduledFor,
      reason: item.classification.reason,
    });
  }

  return {
    dryRun: false,
    windowHours,
    maxCreate,
    intervalHours,
    candidates: candidates.map((item) => item.classification),
    created,
    skipped,
  };
}
