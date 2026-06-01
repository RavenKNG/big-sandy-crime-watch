import type { PublicRecordDemo, ChargeDemo } from "@prisma/client";
import type { DemoRecord } from "./types";

export const publishedRecordOrder = [
  { bookingDate: "desc" as const },
  { bookingTimeKnown: "desc" as const },
  { recordDate: "desc" as const },
  { displayName: "asc" as const },
];

export type StoredRecordWithCharges = PublicRecordDemo & { charges: ChargeDemo[] };

export function storedRecordToDemoRecord(record: StoredRecordWithCharges): DemoRecord {
  return {
    slug: record.slug,
    displayName: record.displayName,
    age: record.age ?? undefined,
    gender: record.gender ?? undefined,
    city: record.city ?? undefined,
    county: record.county ?? "",
    state: record.state ?? undefined,
    arrestingAgency: record.arrestingAgency ?? undefined,
    arrestingOfficer: record.arrestingOfficer ?? undefined,
    bookingDateTimeText: record.bookingDateTimeText ?? undefined,
    bookingTimeKnown: record.bookingTimeKnown,
    recordDate: record.recordDate.toISOString(),
    status: record.status ?? "",
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl ?? undefined,
    sourceTimestamp: record.sourceTimestamp.toISOString(),
    imageUrl: record.imageUrl ?? record.imageLocalPath ?? undefined,
    publishStatus: record.publishStatus,
    charges: record.charges.map((charge) => ({
      offense: charge.offense,
      statute: charge.statute ?? undefined,
      chargeDescription: charge.chargeDescription,
      caseNumber: charge.caseNumber ?? undefined,
    })),
  };
}

export function bookingDisplayText(record: Pick<DemoRecord, "bookingDateTimeText" | "recordDate" | "bookingTimeKnown">) {
  if (record.bookingDateTimeText) return record.bookingDateTimeText;
  const fallback = new Date(record.recordDate).toLocaleDateString();
  return record.bookingTimeKnown ? fallback : `${fallback} - time unknown`;
}

export function todayBounds(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const start = new Date(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}
