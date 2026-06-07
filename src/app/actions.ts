"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { correctionFormSchema, parseChargeLines, recordFormSchema } from "@/lib/forms";
import { slugify } from "@/lib/content";
import { createOfficialNewsFacebookDraft } from "@/lib/official-news-db";
import { generateOfficialNewsCards } from "@/lib/official-news-card";

export async function createDemoRecord(formData: FormData) {
  const values = recordFormSchema.parse(Object.fromEntries(formData));
  const slug = `${slugify(values.displayName)}-${Date.now()}`;
  const record = await getDb().publicRecordDemo.create({ data: {
    slug, displayName: values.displayName, county: values.county,
    recordDate: new Date(values.recordDate), bookingDate: new Date(`${values.recordDate.slice(0,10)}T00:00:00.000Z`), bookingDateTimeText: values.recordDate, bookingTimeKnown: values.recordDate.includes("T"), status: "Synthetic demo draft pending editorial review",
    sourceName: values.sourceName, sourceUrl: values.sourceUrl || null,
    sourceTimestamp: new Date(values.sourceTimestamp), imageUrl: values.imageUrl || null,
    complianceNotes: values.complianceNotes, publishStatus: "DRAFT",
    charges: { create: parseChargeLines(values.charges) },
  } });
  redirect(`/admin/records/${record.slug}`);
}

export async function updateDemoRecordStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const publishStatus = String(formData.get("publishStatus")) as "PUBLISHED" | "HIDDEN" | "REJECTED";
  if (!["PUBLISHED", "HIDDEN", "REJECTED"].includes(publishStatus)) throw new Error("Invalid status");
  await getDb().publicRecordDemo.update({ where: { id }, data: { publishStatus } });
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function submitCorrection(formData: FormData) {
  const values = correctionFormSchema.parse(Object.fromEntries(formData));
  await getDb().correctionRequest.create({ data: { ...values, relatedUrl: values.relatedUrl || null } });
  redirect("/correction-request?submitted=1");
}

export async function updateCorrectionStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "NEW" | "REVIEWING" | "RESOLVED" | "DENIED";
  if (!["NEW", "REVIEWING", "RESOLVED", "DENIED"].includes(status)) throw new Error("Invalid status");
  await getDb().correctionRequest.update({ where: { id }, data: { status } });
  revalidatePath("/admin");
}

export async function saveSponsor(formData: FormData) {
  await getDb().sponsorAd.create({ data: {
    name: String(formData.get("name")), placement: String(formData.get("placement")),
    imageUrl: String(formData.get("imageUrl")) || null,
    linkUrl: String(formData.get("url")) || null, text: String(formData.get("text")) || null, enabled: false,
  } });
  revalidatePath("/admin/sponsors");
}

export async function markRecordManuallyPosted(formData: FormData) {
  await getDb().publicRecordDemo.update({ where: { id: String(formData.get("id")) }, data: { facebookPostStatus: "POSTED" } });
  revalidatePath("/admin/facebook-export");
}

export async function updateOfficialNewsReviewStatus(formData: FormData) {
  const id = String(formData.get("id"));
  const reviewStatus = String(formData.get("reviewStatus"));
  if (!["PENDING", "REVIEWED", "HOLD"].includes(reviewStatus)) throw new Error("Invalid official news status");
  await getDb().officialNewsStory.update({ where: { id }, data: { reviewStatus } });
  revalidatePath("/admin/official-news");
}

export async function regenerateOfficialNewsCard(formData: FormData) {
  const id = String(formData.get("id"));
  const db = getDb();
  const story = await db.officialNewsStory.findUnique({ where: { id } });
  if (!story) throw new Error("Official news story not found");
  const cards = await generateOfficialNewsCards({
    title: story.title,
    postLabel: story.postLabel ?? undefined,
    publishedAt: story.publishedAt ?? undefined,
    county: story.county ?? undefined,
    city: story.city ?? undefined,
    region: story.region ?? undefined,
    canonicalUrl: story.canonicalUrl,
  });
  await db.officialNewsStory.update({
    where: { id },
    data: {
      cardImageHorizontalUrl: cards.horizontalPath,
      cardImageVerticalUrl: cards.verticalPath,
      heroImageUrl: story.officialImageUrl ?? cards.horizontalPath,
    },
  });
  await Promise.all([
    db.officialNewsGeneratedAsset.create({
      data: {
        storyId: id,
        assetType: "CARD_1200x630",
        publicUrl: cards.horizontalPath,
        width: 1200,
        height: 630,
        status: "READY",
      },
    }),
    db.officialNewsGeneratedAsset.create({
      data: {
        storyId: id,
        assetType: "CARD_1080x1920",
        publicUrl: cards.verticalPath,
        width: 1080,
        height: 1920,
        status: "READY",
      },
    }),
  ]);
  revalidatePath("/admin/official-news");
}

export async function createOfficialNewsDraftAction(formData: FormData) {
  const id = String(formData.get("id"));
  const db = getDb();
  const story = await db.officialNewsStory.findUnique({ where: { id }, include: { article: true } });
  if (!story?.article) throw new Error("Official news story does not have an article");
  const draft = await createOfficialNewsFacebookDraft(
    {
      sourceSlug: story.sourceId,
      sourceUrl: story.sourceUrl,
      canonicalUrl: story.canonicalUrl,
      title: story.title,
      publishedAt: story.publishedAt ?? undefined,
      sourceName: story.sourceName,
      agency: story.agency,
      postLabel: story.postLabel ?? undefined,
      county: story.county ?? undefined,
      city: story.city ?? undefined,
      region: story.region ?? undefined,
      sourceText: story.generatedArticleBody ?? story.summary ?? story.title,
      officialImageUrl: story.cardImageHorizontalUrl ?? story.officialImageUrl ?? undefined,
      tags: [],
      sourceTextHash: story.sourceTextHash,
    },
    story.article,
  );
  if (draft.id) {
    await db.officialNewsStory.update({
      where: { id },
      data: { facebookDraftId: draft.id, postStatus: "MANUAL_REQUIRED" },
    });
  }
  revalidatePath("/admin/official-news");
}
