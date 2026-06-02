import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { getDb } from "./db";
import { createFacebookRecordCaption } from "./facebook-record-caption";
import { facebookRecordUrl } from "./facebook-links";

export const OFFICIAL_SOURCE_NAME = "Big Sandy Regional Detention Center Public Roster";
export const OFFICIAL_ROSTER_URL =
  "http://bsrdc.com/InmateRoster/BSRDC_inmatelist.html";
export const OFFICIAL_AGENCY_CODE = "BIGSANDYKYRDC";
export const OFFICIAL_API_ROOT =
  "https://omsweb.public-safety-cloud.com/publicroster-api/api";

function officialRosterUrl(): string {
  return process.env.OFFICIAL_SOURCE_URL || OFFICIAL_ROSTER_URL;
}

function officialApiRoot(): string {
  return process.env.OFFICIAL_SOURCE_API_URL || OFFICIAL_API_ROOT;
}

type VendorDetailSection = {
  filename?: string;
  type?: string;
  data?: Array<Record<string, unknown>>;
};

export type VendorRosterRow = {
  id?: number | string;
  agencyOffenderId?: number | string;
  agencyOffenderPermanentId?: string;
  firstName?: string;
  lastName?: string;
  middleName?: string;
  nameSuffix?: string;
  gender?: string;
  supervisionStatus?: string;
  imageUri?: string;
  detailsJson?: string;
  bookDate?: string;
  releaseDate?: string;
  createdDateTime?: string;
  updatedDateTime?: string;
  multiAgencyName?: string;
  hasImage?: boolean;
};

export type OfficialCharge = {
  offense: string;
  statute?: string;
  chargeDescription: string;
  caseNumber?: string;
  displayOrder: number;
};

export type ParsedOfficialRecord = {
  sourceRecordId: string;
  sourceFingerprint: string;
  slug: string;
  displayName: string;
  age?: number;
  gender?: string;
  city?: string;
  county?: string;
  state?: string;
  arrestingAgency?: string;
  arrestingOfficer?: string;
  bookingDateTimeText?: string;
  bookingDate: Date;
  bookingTimeKnown: boolean;
  recordDate: Date;
  status?: string;
  sourceName: string;
  sourceUrl: string;
  sourceTimestamp: Date;
  imageId?: string;
  charges: OfficialCharge[];
};

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function easternDayKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function parseVendorDate(value?: string): {
  original?: string;
  dayKey: string;
  bookingDate: Date;
  recordDate: Date;
  bookingTimeKnown: boolean;
} {
  const original = text(value);
  const match = original?.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}):(\d{2}))?$/,
  );
  if (!match) {
    const now = new Date();
    const dayKey = easternDayKey(now);
    return {
      original,
      dayKey,
      bookingDate: new Date(`${dayKey}T00:00:00.000Z`),
      recordDate: now,
      bookingTimeKnown: false,
    };
  }

  const [, month, day, year, hour = "0", minute = "0", second = "0"] = match;
  const dayKey = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const bookingTimeKnown = `${hour}:${minute}:${second}` !== "0:0:0" && `${hour}:${minute}:${second}` !== "00:00:00";
  return {
    original,
    dayKey,
    bookingDate: new Date(`${dayKey}T00:00:00.000Z`),
    recordDate: new Date(`${dayKey}T${hour.padStart(2, "0")}:${minute}:${second}-04:00`),
    bookingTimeKnown,
  };
}

function details(row: VendorRosterRow): VendorDetailSection[] {
  if (!row.detailsJson) return [];
  try {
    const parsed = JSON.parse(row.detailsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function additionalInfo(sections: VendorDetailSection[]): Map<string, string> {
  const info = new Map<string, string>();
  const section = sections.find(
    (item) => item.filename === "AdditionalInfo" && item.type === "nvp",
  );
  for (const item of section?.data ?? []) {
    const name = text(item.Name);
    const value = text(item.Value);
    if (name && value) info.set(name, value);
  }
  return info;
}

function charges(sections: VendorDetailSection[]): OfficialCharge[] {
  const section = sections.find(
    (item) => item.filename === "CriminalOffenses" && item.type === "table",
  );
  const rows = section?.data ?? [];
  if (rows.length === 0) {
    return [
      {
        offense: "Charges unavailable from source at time of import",
        chargeDescription: "Charges unavailable from source at time of import.",
        displayOrder: 1,
      },
    ];
  }

  return rows.map((row, index) => ({
    offense: text(row.Offense) ?? text(row["Charge Description"]) ?? "Listed charge",
    statute: text(row.Statute),
    chargeDescription:
      text(row["Charge Description"]) ?? text(row.Offense) ?? "Listed charge",
    caseNumber: text(row["Case Number"]),
    displayOrder: index + 1,
  }));
}

function fingerprint(record: {
  displayName: string;
  bookingDateTimeText?: string;
  sourceName: string;
  charges: OfficialCharge[];
}): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        record.displayName.toLowerCase(),
        record.bookingDateTimeText ?? "",
        record.sourceName,
        ...record.charges.map((charge) =>
          `${charge.offense}|${charge.statute ?? ""}|${charge.chargeDescription}`.toLowerCase(),
        ),
      ].join("::"),
    )
    .digest("hex");
}

export function parseOfficialRosterRows(rows: VendorRosterRow[]): ParsedOfficialRecord[] {
  return rows.flatMap((row) => {
    const sourceRecordId = text(String(row.agencyOffenderPermanentId ?? row.agencyOffenderId ?? row.id ?? ""));
    const displayName = [row.firstName, row.middleName, row.lastName, row.nameSuffix]
      .map(text)
      .filter(Boolean)
      .join(" ");
    if (!sourceRecordId || !displayName) return [];

    const booking = parseVendorDate(row.bookDate);
    const sections = details(row);
    const info = additionalInfo(sections);
    const recordCharges = charges(sections);
    const sourceUrl = `${officialRosterUrl()}#offender-${encodeURIComponent(sourceRecordId)}`;
    const sourceTimestamp = row.updatedDateTime
      ? new Date(`${row.updatedDateTime}Z`)
      : new Date();
    const parsed = {
      sourceRecordId,
      slug: slugify(`${displayName}-${sourceRecordId}`),
      displayName,
      age: Number.parseInt(info.get("Age") ?? "", 10) || undefined,
      gender: text(row.gender),
      county: info.get("County Arrested"),
      arrestingAgency: info.get("Arresting Agency"),
      arrestingOfficer: info.get("Arresting Officer"),
      bookingDateTimeText: booking.original,
      bookingDate: booking.bookingDate,
      bookingTimeKnown: booking.bookingTimeKnown,
      recordDate: booking.recordDate,
      status: text(row.supervisionStatus),
      sourceName: OFFICIAL_SOURCE_NAME,
      sourceUrl,
      sourceTimestamp: Number.isNaN(sourceTimestamp.getTime()) ? new Date() : sourceTimestamp,
      imageId: row.hasImage ? text(row.imageUri) : undefined,
      charges: recordCharges,
    };
    return [{ ...parsed, sourceFingerprint: fingerprint(parsed) }];
  });
}

function dateKeyOffset(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return easternDayKey(date);
}

export function lastThreeEasternDays() {
  return { fromDate: dateKeyOffset(2), toDate: dateKeyOffset(0) };
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

export async function fetchOfficialRoster(fromDate: string, toDate: string) {
  const response = await fetchWithTimeout(
    `${officialApiRoot()}/${OFFICIAL_AGENCY_CODE}/search-offenders`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recaptchaToken: "",
        agencyCode: OFFICIAL_AGENCY_CODE,
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
  if (!response.ok) throw new Error(`Official roster request failed with status ${response.status}.`);
  const json = (await response.json()) as { data?: VendorRosterRow[] };
  return parseOfficialRosterRows(Array.isArray(json.data) ? json.data : []);
}

async function persistImage(slug: string, imageId?: string) {
  if (!imageId) return undefined;
  const sasResponse = await fetchWithTimeout(
    `${officialApiRoot()}/${OFFICIAL_AGENCY_CODE}/get-sas-image-url/${encodeURIComponent(imageId)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recaptchaToken: null }),
    },
  );
  if (!sasResponse.ok) return undefined;
  const sasJson = (await sasResponse.json()) as { url?: unknown };
  if (typeof sasJson.url !== "string" || !sasJson.url) return undefined;
  const response = await fetchWithTimeout(sasJson.url);
  if (!response.ok) return undefined;
  const contentType = response.headers.get("content-type") ?? "";
  const extension = contentType.includes("png") ? ".png" : ".jpg";
  const publicDir = path.join(process.cwd(), "public", "booking-images", slug);
  await fs.mkdir(publicDir, { recursive: true });
  const destination = path.join(publicDir, `mugshot${extension}`);
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
  return `/booking-images/${slug}/mugshot${extension}`;
}

async function createFacebookDraft(record: {
  id: string;
  slug: string;
  displayName: string;
  age: number | null;
  recordDate: Date;
  arrestingAgency: string | null;
  arrestingOfficer: string | null;
  imageUrl: string | null;
  imageLocalPath: string | null;
  charges: OfficialCharge[];
}) {
  const db = getDb();
  const existing = await db.facebookDraft.findFirst({ where: { recordId: record.id } });
  if (existing) {
    await db.publicRecordDemo.update({
      where: { id: record.id },
      data: { facebookPostStatus: existing.status === "POSTED" ? "POSTED" : "DRAFTED" },
    });
    return { created: false, id: existing.id };
  }
  const postUrl = facebookRecordUrl(record.slug, process.env.SITE_URL);
  const draft = await db.facebookDraft.create({
    data: {
      recordId: record.id,
      status: "DRAFTED",
      scheduledFor: new Date(),
      postText: createFacebookRecordCaption(record, postUrl),
      postUrl,
      imageUrl: record.imageUrl || record.imageLocalPath,
    },
  });
  await db.publicRecordDemo.update({
    where: { id: record.id },
    data: { facebookPostStatus: "DRAFTED" },
  });
  return { created: true, id: draft.id };
}

export async function importOfficialRosterRecords(records: ParsedOfficialRecord[]) {
  const db = getDb();
  const summary = { found: records.length, created: 0, updated: 0, duplicatesSkipped: 0, failed: 0, imagesSaved: 0, missingImages: 0, draftsCreated: 0, failures: [] as string[] };
  for (const record of records) {
    try {
      const existing = await db.publicRecordDemo.findFirst({
        where: {
          OR: [
            { sourceRecordId: record.sourceRecordId },
            { sourceUrl: record.sourceUrl },
            { sourceFingerprint: record.sourceFingerprint },
            { slug: record.slug },
          ],
        },
        include: { charges: true },
      });
      const imageMissing = Boolean(record.imageId && !existing?.imageUrl && !existing?.imageLocalPath);
      if (existing?.sourceFingerprint === record.sourceFingerprint) {
        let imagePath = existing.imageUrl ?? existing.imageLocalPath ?? undefined;
        if (imageMissing) {
          imagePath = await persistImage(record.slug, record.imageId);
          if (imagePath) {
            await db.publicRecordDemo.update({
              where: { id: existing.id },
              data: { imageUrl: imagePath, imageLocalPath: imagePath },
            });
            summary.imagesSaved += 1;
          } else {
            summary.missingImages += 1;
          }
        }
        if (imagePath) {
          await db.facebookDraft.updateMany({
            where: { recordId: existing.id, imageUrl: null },
            data: { imageUrl: imagePath },
          });
        }
        summary.duplicatesSkipped += 1;
        continue;
      }
      const imagePath = await persistImage(record.slug, record.imageId);
      if (imagePath) summary.imagesSaved += 1;
      else summary.missingImages += 1;

      const data = {
        slug: record.slug,
        displayName: record.displayName,
        age: record.age,
        gender: record.gender,
        county: record.county,
        arrestingAgency: record.arrestingAgency,
        arrestingOfficer: record.arrestingOfficer,
        sourceRecordId: record.sourceRecordId,
        sourceFingerprint: record.sourceFingerprint,
        bookingDateTimeText: record.bookingDateTimeText,
        bookingDate: record.bookingDate,
        bookingTimeKnown: record.bookingTimeKnown,
        recordDate: record.recordDate,
        status: record.status,
        sourceName: record.sourceName,
        sourceUrl: record.sourceUrl,
        sourceTimestamp: record.sourceTimestamp,
        imageUrl: imagePath ?? existing?.imageUrl,
        imageLocalPath: imagePath ?? existing?.imageLocalPath,
        publishStatus: "PUBLISHED" as const,
        charges: {
          create: record.charges,
        },
      };

      let persisted;
      if (existing) {
        await db.chargeDemo.deleteMany({ where: { recordId: existing.id } });
        persisted = await db.publicRecordDemo.update({ where: { id: existing.id }, data });
        summary.updated += 1;
      } else {
        persisted = await db.publicRecordDemo.create({ data });
        summary.created += 1;
      }

      const draft = await createFacebookDraft({ ...persisted, charges: record.charges });
      if (draft.created) summary.draftsCreated += 1;
      else summary.duplicatesSkipped += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  return summary;
}

export async function runOfficialSourceImport() {
  if (process.env.OFFICIAL_SOURCE_FETCH_ENABLED !== "true") {
    return { skipped: true, reason: "OFFICIAL_SOURCE_FETCH_ENABLED is not true." };
  }
  if (process.env.AUTO_IMPORT_OFFICIAL_RECORDS !== "true") {
    return { skipped: true, reason: "AUTO_IMPORT_OFFICIAL_RECORDS is not true." };
  }
  if (process.env.AUTO_PUBLISH_VALID_IMPORTED_RECORDS !== "true") {
    return { skipped: true, reason: "AUTO_PUBLISH_VALID_IMPORTED_RECORDS is not true." };
  }
  const range = lastThreeEasternDays();
  const records = await fetchOfficialRoster(range.fromDate, range.toDate);
  return { skipped: false, range, ...(await importOfficialRosterRecords(records)) };
}
