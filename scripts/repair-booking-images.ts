import { getDb } from "../src/lib/db";
import {
  bookingImageExists,
  writeBookingImageFromBuffer,
} from "../src/lib/booking-image-storage";
import { officialSourceApiRoot, officialSources } from "../src/lib/official-sources";

type VendorRosterRow = {
  id?: number | string;
  agencyOffenderId?: number | string;
  agencyOffenderPermanentId?: string;
  imageUri?: string;
  bookDate?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  nameSuffix?: string;
};

function sourceKey(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function searchOffenders(agencyCode: string, fromDate: string, toDate: string) {
  const response = await fetchWithTimeout(
    `${officialSourceApiRoot()}/${agencyCode}/search-offenders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recaptchaToken: "",
        agencyCode,
        supervisionStatus: "All",
        firstName: "",
        lastName: "",
        middleName: "",
        agencyOffenderId: null,
        agencyOffenderPermanentId: "",
        gender: "",
        bookDateStart: fromDate,
        bookDateEnd: toDate,
        releaseDateStart: null,
        releaseDateEnd: null,
        multiAgencyName: null,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Official source search failed with status ${response.status}`);
  }
  const json = (await response.json()) as { data?: VendorRosterRow[] };
  return Array.isArray(json.data) ? json.data : [];
}

async function fetchImagePath(agencyCode: string, imageId: string, slug: string) {
  const sasResponse = await fetchWithTimeout(
    `${officialSourceApiRoot()}/${agencyCode}/get-sas-image-url/${encodeURIComponent(imageId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recaptchaToken: null }),
    },
  );
  if (!sasResponse.ok) return undefined;
  const sasJson = (await sasResponse.json()) as { url?: unknown };
  if (typeof sasJson.url !== "string" || !sasJson.url) return undefined;
  const imageResponse = await fetchWithTimeout(sasJson.url);
  if (!imageResponse.ok) return undefined;
  const contentType = imageResponse.headers.get("content-type") ?? "";
  const extension = contentType.includes("png") ? ".png" : ".jpg";
  return writeBookingImageFromBuffer(
    slug,
    extension,
    Buffer.from(await imageResponse.arrayBuffer()),
  );
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function vendorDisplayName(row: VendorRosterRow) {
  return [row.firstName, row.middleName, row.lastName, row.nameSuffix]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}

function bookingDayKey(value?: string | Date) {
  if (!value) return undefined;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return undefined;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

async function main() {
  const source = officialSources.find((item) => item.slug === "big-sandy-regional-detention-center");
  if (!source?.agencyCode) {
    throw new Error("Big Sandy official source config missing agency code.");
  }

  const db = getDb();
  const records = await db.publicRecordDemo.findMany({
    where: {
      publishStatus: "PUBLISHED",
      sourceName: source.sourceName,
      OR: [{ imageUrl: { not: null } }, { imageLocalPath: { not: null } }],
    },
    select: {
      id: true,
      slug: true,
      displayName: true,
      sourceRecordId: true,
      imageUrl: true,
      imageLocalPath: true,
      bookingDate: true,
    },
  });

  const missing = [];
  for (const record of records) {
    const imageReference = record.imageUrl ?? record.imageLocalPath;
    if (!(await bookingImageExists(imageReference))) {
      missing.push(record);
    }
  }

  if (missing.length === 0) {
    console.log(JSON.stringify({ checked: records.length, repaired: 0, remainingMissing: 0 }, null, 2));
    return;
  }

  const dates = missing.map((record) => record.bookingDate);
  const fromDate = new Date(Math.min(...dates.map((date) => date.getTime()))).toISOString().slice(0, 10);
  const toDate = new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString().slice(0, 10);

  const offenders = await searchOffenders(source.agencyCode, fromDate, toDate);
  const byAnyId = new Map<string, VendorRosterRow>();
  const byNameAndDate = new Map<string, VendorRosterRow>();
  for (const offender of offenders) {
    for (const key of [
      sourceKey(offender.agencyOffenderPermanentId),
      sourceKey(offender.agencyOffenderId),
      sourceKey(offender.id),
    ]) {
      if (key) byAnyId.set(key, offender);
    }
    const name = normalizeName(vendorDisplayName(offender));
    const dayKey = bookingDayKey(offender.bookDate);
    if (name && dayKey) {
      byNameAndDate.set(`${name}|${dayKey}`, offender);
    }
  }

  let repaired = 0;
  let cleared = 0;
  const failures: string[] = [];

  for (const record of missing) {
    const key =
      record.sourceRecordId?.includes(":")
        ? record.sourceRecordId.split(":").pop()
        : record.sourceRecordId ?? record.slug.split("-").at(-1);
    const offender =
      (key ? byAnyId.get(key) : undefined) ??
      byNameAndDate.get(`${normalizeName(record.displayName)}|${bookingDayKey(record.bookingDate)}`);
    if (!offender?.imageUri) {
      await db.publicRecordDemo.update({
        where: { id: record.id },
        data: {
          imageUrl: null,
          imageLocalPath: null,
        },
      });
      await db.facebookDraft.updateMany({
        where: { recordId: record.id, imageUrl: record.imageUrl ?? record.imageLocalPath ?? undefined },
        data: { imageUrl: null },
      });
      cleared += 1;
      failures.push(`${record.slug}: no matching offender imageUri found`);
      continue;
    }

    const imagePath = await fetchImagePath(source.agencyCode, offender.imageUri, record.slug);
    if (!imagePath) {
      await db.publicRecordDemo.update({
        where: { id: record.id },
        data: {
          imageUrl: null,
          imageLocalPath: null,
        },
      });
      await db.facebookDraft.updateMany({
        where: { recordId: record.id, imageUrl: record.imageUrl ?? record.imageLocalPath ?? undefined },
        data: { imageUrl: null },
      });
      cleared += 1;
      failures.push(`${record.slug}: unable to download image`);
      continue;
    }

    await db.publicRecordDemo.update({
      where: { id: record.id },
      data: {
        imageUrl: imagePath,
        imageLocalPath: imagePath,
      },
    });
    await db.facebookDraft.updateMany({
      where: { recordId: record.id, imageUrl: null },
      data: { imageUrl: imagePath },
    });
    repaired += 1;
  }

  console.log(
    JSON.stringify(
      {
        checked: records.length,
        missing: missing.length,
        repaired,
        cleared,
        remainingMissing: missing.length - repaired - cleared,
        failures,
      },
      null,
      2,
    ),
  );
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
