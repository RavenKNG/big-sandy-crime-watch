"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { correctionFormSchema, parseChargeLines, recordFormSchema } from "@/lib/forms";
import { slugify } from "@/lib/content";

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
