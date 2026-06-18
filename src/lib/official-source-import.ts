import crypto from "node:crypto";
import { getDb } from "./db";
import { createFacebookRecordDraftPayload } from "./facebook-record-drafts";
import {
  automaticOfficialSources,
  findOfficialSourceBySlug,
  officialSourceApiHeaders,
  officialSourceApiRoot,
  officialSourceRosterUrl,
  type OfficialSourceConfig,
} from "./official-sources";
import {
  bookingImageExists,
  writeBookingImageFromBuffer,
} from "./booking-image-storage";

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
  sourceSlug: string;
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

export type OfficialSourceImportSummary = {
  sourceSlug: string;
  sourceName: string;
  skipped: boolean;
  blocked?: boolean;
  reason?: string;
  range?: {
    fromDate: string;
    toDate: string;
  };
  found: number;
  created: number;
  updated: number;
  duplicatesSkipped: number;
  failed: number;
  imagesSaved: number;
  missingImages: number;
  draftsCreated: number;
  failures: string[];
  detectedCounties: string[];
  detectedAgencies: string[];
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

function parseVendorDate(value?: string) {
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
  const bookingTimeKnown =
    `${hour}:${minute}:${second}` !== "0:0:0" &&
    `${hour}:${minute}:${second}` !== "00:00:00";

  return {
    original,
    dayKey,
    bookingDate: new Date(`${dayKey}T00:00:00.000Z`),
    recordDate: new Date(
      `${dayKey}T${hour.padStart(2, "0")}:${minute}:${second}-04:00`,
    ),
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

function inferCountyFromAgency(value?: string): string | undefined {
  const agency = text(value);
  if (!agency) return undefined;
  const match = agency.match(/([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+County/i);
  return match?.[1]?.replace(/\s+/g, " ").trim();
}

function detectAssociatedCounty(source: OfficialSourceConfig, info: Map<string, string>, row: VendorRosterRow) {
  return (
    text(info.get("County Arrested")) ||
    inferCountyFromAgency(info.get("Arresting Agency")) ||
    inferCountyFromAgency(row.multiAgencyName) ||
    source.facilityCounty
  );
}

function fingerprint(record: {
  sourceSlug: string;
  displayName: string;
  bookingDateTimeText?: string;
  sourceName: string;
  charges: OfficialCharge[];
}): string {
  return crypto
    .createHash("sha256")
    .update(
      [
        record.sourceSlug,
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

export function parseOfficialRosterRows(
  rows: VendorRosterRow[],
  source: OfficialSourceConfig,
): ParsedOfficialRecord[] {
  return rows.flatMap((row) => {
    const vendorId = text(
      String(row.agencyOffenderPermanentId ?? row.agencyOffenderId ?? row.id ?? ""),
    );
    const displayName = [row.firstName, row.middleName, row.lastName, row.nameSuffix]
      .map(text)
      .filter(Boolean)
      .join(" ");
    if (!vendorId || !displayName) return [];

    const sourceRecordId = `${source.slug}:${vendorId}`;
    const booking = parseVendorDate(row.bookDate);
    const sections = details(row);
    const info = additionalInfo(sections);
    const recordCharges = charges(sections);
    const sourceUrl = `${officialSourceRosterUrl(source)}#offender-${encodeURIComponent(vendorId)}`;
    const sourceTimestamp = row.updatedDateTime
      ? new Date(`${row.updatedDateTime}Z`)
      : new Date();
    const parsed = {
      sourceSlug: source.slug,
      sourceRecordId,
      slug: slugify(`${displayName}-${source.slug}-${vendorId}`),
      displayName,
      age: Number.parseInt(info.get("Age") ?? "", 10) || undefined,
      gender: text(row.gender),
      county: detectAssociatedCounty(source, info, row),
      city: source.facilityCity,
      state: "KY",
      arrestingAgency: text(info.get("Arresting Agency")) ?? text(row.multiAgencyName),
      arrestingOfficer: info.get("Arresting Officer"),
      bookingDateTimeText: booking.original,
      bookingDate: booking.bookingDate,
      bookingTimeKnown: booking.bookingTimeKnown,
      recordDate: booking.recordDate,
      status: text(row.supervisionStatus),
      sourceName: source.sourceName,
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

async function fetchPublicRosterApi(source: OfficialSourceConfig, fromDate: string, toDate: string) {
  const response = await fetchWithTimeout(
    `${officialSourceApiRoot()}/${source.agencyCode}/search-offenders`,
    {
      method: "POST",
      headers: officialSourceApiHeaders(),
      body: JSON.stringify({
        recaptchaToken: "",
        agencyCode: source.agencyCode,
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
  if (!response.ok) throw new Error(`${source.sourceName} request failed with status ${response.status}.`);
  const json = (await response.json()) as { data?: VendorRosterRow[] };
  return parseOfficialRosterRows(Array.isArray(json.data) ? json.data : [], source);
}

type JailTrackerOffenderResponse = {
  captchaRequired?: boolean;
  offenders?: VendorRosterRow[];
  errorMessage?: string;
};

async function fetchJailTrackerCaptchaSource(source: OfficialSourceConfig): Promise<OfficialSourceImportSummary> {
  const agencyResponse = await fetchWithTimeout(
    `https://omsweb.public-safety-cloud.com/jtclientweb/Offender/${source.routeSlug}/AgencyOptions`,
  );
  if (!agencyResponse.ok) {
    throw new Error(`${source.sourceName} agency options request failed with status ${agencyResponse.status}.`);
  }

  const rosterResponse = await fetchWithTimeout(
    `https://omsweb.public-safety-cloud.com/jtclientweb/Offender/${source.routeSlug}`,
    {
      method: "POST",
      headers: officialSourceApiHeaders(),
      body: JSON.stringify({
        captchaKey: null,
        captchaImage: null,
        userCode: "",
      }),
    },
  );
  if (!rosterResponse.ok) {
    throw new Error(`${source.sourceName} roster request failed with status ${rosterResponse.status}.`);
  }

  const payload = (await rosterResponse.json()) as JailTrackerOffenderResponse;
  if (payload.captchaRequired) {
    return {
      sourceSlug: source.slug,
      sourceName: source.sourceName,
      skipped: true,
      blocked: true,
      reason:
        "Vendor JailTracker route requires an interactive captcha challenge before offender data is returned. Automated import remains disabled for this source.",
      found: 0,
      created: 0,
      updated: 0,
      duplicatesSkipped: 0,
      failed: 0,
      imagesSaved: 0,
      missingImages: 0,
      draftsCreated: 0,
      failures: [],
      detectedCounties: [],
      detectedAgencies: [],
    };
  }

  return {
    sourceSlug: source.slug,
    sourceName: source.sourceName,
    skipped: false,
    found: Array.isArray(payload.offenders) ? payload.offenders.length : 0,
    created: 0,
    updated: 0,
    duplicatesSkipped: 0,
    failed: 0,
    imagesSaved: 0,
    missingImages: 0,
    draftsCreated: 0,
    failures: payload.errorMessage ? [payload.errorMessage] : [],
    detectedCounties: [],
    detectedAgencies: [],
  };
}

async function persistImage(source: OfficialSourceConfig, slug: string, imageId?: string) {
  if (!imageId || !source.agencyCode) return undefined;
  const sasResponse = await fetchWithTimeout(
    `${officialSourceApiRoot()}/${source.agencyCode}/get-sas-image-url/${encodeURIComponent(imageId)}`,
    {
      method: "POST",
      headers: officialSourceApiHeaders(),
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
  return writeBookingImageFromBuffer(slug, extension, Buffer.from(await response.arrayBuffer()));
}

async function createFacebookDraft(record: {
  id: string;
  slug: string;
  displayName: string;
  age: number | null;
  county: string | null;
  recordDate: Date;
  bookingDateTimeText: string | null;
  bookingTimeKnown: boolean;
  arrestingAgency: string | null;
  arrestingOfficer: string | null;
  sourceName: string;
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
  const draftPayload = await createFacebookRecordDraftPayload(record, process.env.SITE_URL);
  const draftStatus = draftPayload.imageUrl ? "DRAFTED" : "MANUAL_REQUIRED";
  const draft = await db.facebookDraft.create({
    data: {
      recordId: record.id,
      status: draftStatus,
      scheduledFor: new Date(),
      ...draftPayload,
    },
  });
  await db.publicRecordDemo.update({
    where: { id: record.id },
    data: { facebookPostStatus: draftStatus },
  });
  return { created: true, id: draft.id };
}

async function persistSourceRun(source: OfficialSourceConfig, summary: OfficialSourceImportSummary) {
  if (!process.env.DATABASE_URL) return;
  const db = getDb();
  await db.sourceImportRun.create({
    data: {
      sourceName: source.sourceName,
      startedAt: new Date(),
      finishedAt: new Date(),
      recordsFound: summary.found,
      recordsCreated: summary.created,
      recordsSkipped: summary.duplicatesSkipped,
      errorsJson: summary,
    },
  });
}

export async function importOfficialRosterRecords(
  source: OfficialSourceConfig,
  records: ParsedOfficialRecord[],
): Promise<OfficialSourceImportSummary> {
  const db = getDb();
  const detectedCounties = new Set<string>();
  const detectedAgencies = new Set<string>();
  const summary: OfficialSourceImportSummary = {
    sourceSlug: source.slug,
    sourceName: source.sourceName,
    skipped: false,
    found: records.length,
    created: 0,
    updated: 0,
    duplicatesSkipped: 0,
    failed: 0,
    imagesSaved: 0,
    missingImages: 0,
    draftsCreated: 0,
    failures: [],
    detectedCounties: [],
    detectedAgencies: [],
  };

  for (const record of records) {
    if (record.county) detectedCounties.add(record.county);
    if (record.arrestingAgency) detectedAgencies.add(record.arrestingAgency);
    try {
      const existing = await db.publicRecordDemo.findFirst({
        where: {
          OR: [
            { sourceRecordId: record.sourceRecordId },
            { sourceFingerprint: record.sourceFingerprint },
            { sourceUrl: record.sourceUrl },
            { slug: record.slug },
          ],
        },
        include: { charges: true },
      });

      const existingImageReference = existing?.imageUrl ?? existing?.imageLocalPath ?? undefined;
      const imageMissing =
        Boolean(record.imageId) &&
        (!existingImageReference || !(await bookingImageExists(existingImageReference)));
      if (existing?.sourceFingerprint === record.sourceFingerprint) {
        let imagePath = existingImageReference;
        if (imageMissing) {
          imagePath = await persistImage(source, record.slug, record.imageId);
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

      const imagePath = await persistImage(source, record.slug, record.imageId);
      if (imagePath) summary.imagesSaved += 1;
      else if (record.imageId) summary.missingImages += 1;

      const data = {
        slug: record.slug,
        displayName: record.displayName,
        age: record.age,
        gender: record.gender,
        city: record.city,
        county: record.county,
        state: record.state,
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

      const draft = await createFacebookDraft({
        ...persisted,
        county: persisted.county,
        sourceName: persisted.sourceName,
        charges: record.charges,
      });
      if (draft.created) summary.draftsCreated += 1;
      else summary.duplicatesSkipped += 1;
    } catch (error) {
      summary.failed += 1;
      summary.failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  summary.detectedCounties = [...detectedCounties].sort();
  summary.detectedAgencies = [...detectedAgencies].sort();
  return summary;
}

async function importSource(
  source: OfficialSourceConfig,
  options: { fromDate?: string; toDate?: string; dryRun?: boolean } = {},
): Promise<OfficialSourceImportSummary> {
  if (source.fetchMode === "jtclientweb-captcha") {
    const blocked = await fetchJailTrackerCaptchaSource(source);
    await persistSourceRun(source, blocked);
    return blocked;
  }

  const range = {
    fromDate: options.fromDate ?? lastThreeEasternDays().fromDate,
    toDate: options.toDate ?? lastThreeEasternDays().toDate,
  };
  const records = await fetchPublicRosterApi(source, range.fromDate, range.toDate);
  const summary = options.dryRun
    ? {
        sourceSlug: source.slug,
        sourceName: source.sourceName,
        skipped: false,
        range,
        found: records.length,
        created: 0,
        updated: 0,
        duplicatesSkipped: 0,
        failed: 0,
        imagesSaved: records.filter((record) => Boolean(record.imageId)).length,
        missingImages: records.filter((record) => !record.imageId).length,
        draftsCreated: 0,
        failures: [],
        detectedCounties: [...new Set(records.map((record) => record.county).filter(Boolean) as string[])].sort(),
        detectedAgencies: [...new Set(records.map((record) => record.arrestingAgency).filter(Boolean) as string[])].sort(),
      }
    : { range, ...(await importOfficialRosterRecords(source, records)) };
  await persistSourceRun(source, summary);
  return summary;
}

export async function runOfficialSourceImport(options: {
  sourceSlugs?: string[];
  fromDate?: string;
  toDate?: string;
  dryRun?: boolean;
} = {}) {
  const manualDryRun = options.dryRun === true;

  if (!manualDryRun && process.env.OFFICIAL_SOURCE_FETCH_ENABLED !== "true") {
    return { skipped: true, reason: "OFFICIAL_SOURCE_FETCH_ENABLED is not true." };
  }
  if (!manualDryRun && process.env.AUTO_IMPORT_OFFICIAL_RECORDS !== "true") {
    return { skipped: true, reason: "AUTO_IMPORT_OFFICIAL_RECORDS is not true." };
  }
  if (!manualDryRun && process.env.AUTO_PUBLISH_VALID_IMPORTED_RECORDS !== "true") {
    return { skipped: true, reason: "AUTO_PUBLISH_VALID_IMPORTED_RECORDS is not true." };
  }

  const selected = options.sourceSlugs?.length
    ? options.sourceSlugs
        .map((slug) => findOfficialSourceBySlug(slug))
        .filter((source): source is OfficialSourceConfig => Boolean(source))
    : automaticOfficialSources();

  const results = [];
  for (const source of selected) {
    results.push(await importSource(source, options));
  }

  if (results.length === 1) return results[0];

  return {
    skipped: false,
    sources: results,
    found: results.reduce((sum, result) => sum + result.found, 0),
    created: results.reduce((sum, result) => sum + result.created, 0),
    updated: results.reduce((sum, result) => sum + result.updated, 0),
    duplicatesSkipped: results.reduce((sum, result) => sum + result.duplicatesSkipped, 0),
    failed: results.reduce((sum, result) => sum + result.failed, 0),
    imagesSaved: results.reduce((sum, result) => sum + result.imagesSaved, 0),
    missingImages: results.reduce((sum, result) => sum + result.missingImages, 0),
    draftsCreated: results.reduce((sum, result) => sum + result.draftsCreated, 0),
  };
}
