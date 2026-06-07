import { prisma } from "./prisma-runtime";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { todayBounds } from "./record-display";
import { copyBookingImageFromFile } from "./booking-image-storage";
import { createFacebookRecordDraftPayload } from "./facebook-record-drafts";
export type ReviewedCharge = {
  offense?: string;
  arrestCode?: string;
  statute?: string;
  chargeDescription: string;
  status?: string;
  caseNumber?: string;
  controlNumber?: string;
  displayOrder?: number;
};

export type ReviewedRecord = {
  fullName: string;
  age?: number;
  gender?: string;
  city?: string;
  race?: string;
  status?: string;
  intakeDate?: string;
  bookingDateTimeText?: string;
  bookingTimeKnown?: boolean;
  releaseDate?: string;
  sourceRecordId?: string;
  offenderId?: string;
  permanentId?: string;
  countyArrested?: string;
  state?: string;
  arrestingAgency?: string;
  arrestingOfficer?: string;
  sourceName: string;
  sourceUrl: string;
  sourceTimestamp?: string;
  imageUrl?: string;
  imageLocalPath?: string;
  complianceNotes?: string;
  charges: ReviewedCharge[];
};

type ImportOptions = {
  folder: string;
  autoPublish?: boolean;
  createFacebookDraft?: boolean;
};

type ImageInfo = {
  absolutePath: string;
  extension: ".jpg" | ".png" | ".webp";
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 90);
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value.replace(/\s+/g, " ").trim();
  return clean.length ? clean : undefined;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      cells.push(cell.trim());
      cell = "";
    } else {
      cell += character;
    }
  }

  cells.push(cell.trim());
  return cells;
}

export function parseReviewedCsv(input: string): ReviewedRecord {
  const lines = input.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error("record.csv must include a header and at least one row.");

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const cells = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] || undefined]));
  });
  const first = rows[0];

  return {
    fullName: first.fullName ?? "",
    age: first.age ? Number.parseInt(first.age, 10) : undefined,
    gender: first.gender,
    city: first.city,
    state: first.state,
    status: first.status,
    intakeDate: first.intakeDate,
    bookingDateTimeText: first.bookingDateTimeText,
    bookingTimeKnown: first.bookingTimeKnown ? first.bookingTimeKnown.toLowerCase() === "true" : undefined,
    releaseDate: first.releaseDate,
    sourceRecordId: first.sourceRecordId,
    offenderId: first.offenderId,
    permanentId: first.permanentId,
    countyArrested: first.countyArrested,
    arrestingAgency: first.arrestingAgency,
    arrestingOfficer: first.arrestingOfficer,
    sourceName: first.sourceName ?? "",
    sourceUrl: first.sourceUrl ?? "",
    sourceTimestamp: first.sourceTimestamp,
    imageUrl: first.imageUrl,
    imageLocalPath: first.imageLocalPath,
    complianceNotes: first.complianceNotes,
    charges: rows.map((row, index) => ({
      offense: row.offense,
      arrestCode: row.arrestCode,
      statute: row.statute,
      chargeDescription: row.chargeDescription ?? "",
      status: row.chargeStatus,
      caseNumber: row.caseNumber,
      controlNumber: row.controlNumber,
      displayOrder: row.displayOrder ? Number.parseInt(row.displayOrder, 10) : index + 1,
    })),
  };
}

function hasExplicitTime(value?: string): boolean {
  return Boolean(value && /\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?)\b/i.test(value));
}

export function resolveBookingDate(raw: Pick<ReviewedRecord, "intakeDate" | "bookingDateTimeText" | "bookingTimeKnown">) {
  const originalText = normalizeText(raw.bookingDateTimeText) ?? normalizeText(raw.intakeDate);
  const parsed = raw.intakeDate ? new Date(raw.intakeDate) : originalText ? new Date(originalText) : undefined;
  const recordDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date();
  const dateText = raw.intakeDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const bookingDate = dateText ? new Date(`${dateText}T00:00:00.000Z`) : todayBounds(recordDate).start;

  return {
    bookingDateTimeText: originalText,
    bookingTimeKnown: raw.bookingTimeKnown ?? hasExplicitTime(originalText),
    bookingDate,
    recordDate,
  };
}

export function normalizeRecord(raw: ReviewedRecord): ReviewedRecord {
  const fullName = normalizeText(raw.fullName);
  if (!fullName) {
    throw new Error("record.json is missing fullName.");
  }

  const sourceName = normalizeText(raw.sourceName);
  const sourceUrl = normalizeText(raw.sourceUrl);

  if (!sourceName) throw new Error("record.json is missing sourceName.");
  if (!sourceUrl) throw new Error("record.json is missing sourceUrl.");

  if (!Array.isArray(raw.charges) || raw.charges.length === 0) {
    throw new Error("record.json must include at least one charge.");
  }

  const charges = raw.charges.map((charge, index) => {
    const description = normalizeText(charge.chargeDescription);
    if (!description) {
      throw new Error(`Charge ${index + 1} is missing chargeDescription.`);
    }

    return {
      offense: normalizeText(charge.offense),
      arrestCode: normalizeText(charge.arrestCode),
      statute: normalizeText(charge.statute),
      chargeDescription: description,
      status: normalizeText(charge.status),
      caseNumber: normalizeText(charge.caseNumber),
      controlNumber: normalizeText(charge.controlNumber),
      displayOrder: charge.displayOrder ?? index + 1,
    };
  });

  return {
    ...raw,
    fullName,
    sourceName,
    sourceUrl,
    sourceTimestamp: raw.sourceTimestamp || new Date().toISOString(),
    status: normalizeText(raw.status) ?? "Listed",
    city: normalizeText(raw.city),
    countyArrested: normalizeText(raw.countyArrested),
    state: normalizeText(raw.state),
    sourceRecordId: normalizeText(raw.sourceRecordId) ?? normalizeText(raw.permanentId) ?? normalizeText(raw.offenderId),
    bookingDateTimeText: normalizeText(raw.bookingDateTimeText) ?? normalizeText(raw.intakeDate),
    arrestingAgency: normalizeText(raw.arrestingAgency),
    arrestingOfficer: normalizeText(raw.arrestingOfficer),
    complianceNotes: normalizeText(raw.complianceNotes),
    charges,
  };
}

function hasAddressLikeText(value: string): boolean {
  return /\b\d{2,6}\s+[A-Za-z0-9.'-]+\s+(street|st|road|rd|lane|ln|drive|dr|avenue|ave|court|ct|circle|cir|highway|hwy)\b/i.test(
    value,
  );
}

function chargeHash(charges: ReviewedCharge[]): string {
  return crypto
    .createHash("sha256")
    .update(
      charges
        .map((charge) =>
          [
            charge.offense,
            charge.arrestCode,
            charge.statute,
            charge.chargeDescription,
            charge.status,
            charge.caseNumber,
            charge.controlNumber,
          ]
            .filter(Boolean)
            .join("|")
            .toLowerCase(),
        )
        .sort()
        .join("::"),
    )
    .digest("hex");
}

function dedupeKey(record: ReviewedRecord): string {
  const hasId = Boolean(record.permanentId || record.offenderId);

  if (hasId && record.intakeDate) {
    return [
      record.permanentId,
      record.offenderId,
      record.intakeDate,
    ]
      .filter(Boolean)
      .join("|")
      .toLowerCase();
  }

  return [
    record.fullName,
    record.intakeDate,
    chargeHash(record.charges),
  ]
    .filter(Boolean)
    .join("|")
    .toLowerCase();
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function readReviewedRecord(folder: string): Promise<ReviewedRecord | undefined> {
  const jsonPath = path.join(folder, "record.json");
  if (await exists(jsonPath)) return readJson<ReviewedRecord>(jsonPath);

  const csvPath = path.join(folder, "record.csv");
  if (await exists(csvPath)) return parseReviewedCsv(await fs.readFile(csvPath, "utf8"));

  return undefined;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function detectImage(filePath: string): Promise<".jpg" | ".png" | ".webp" | null> {
  const buffer = await fs.readFile(filePath);
  if (buffer.length < 12) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return ".png";
  }

  if (
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return ".webp";
  }

  return null;
}

async function findImageFile(folder: string): Promise<ImageInfo | null> {
  const files = await fs.readdir(folder);

  for (const file of files) {
    const absolutePath = path.join(folder, file);
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) continue;

    if (file.toLowerCase() === "record.json") continue;

    const extension = await detectImage(absolutePath);
    if (extension) {
      return { absolutePath, extension };
    }
  }

  return null;
}

async function ensureRecordTemplate(folder: string): Promise<string> {
  const templatePath = path.join(folder, "record.template.json");

  const template: ReviewedRecord = {
    fullName: "First Middle Last",
    age: 0,
    gender: "M",
    city: "City listed by source",
    race: "Unknown",
    status: "Listed",
    intakeDate: new Date().toISOString(),
    bookingDateTimeText: "May 31, 2026 10:30 AM",
    bookingTimeKnown: true,
    releaseDate: undefined,
    sourceRecordId: "SOURCE-RECORD-ID-HERE",
    offenderId: "OFFENDER-ID-HERE",
    permanentId: "PERMANENT-ID-HERE",
    countyArrested: "Johnson",
    state: "KY",
    arrestingAgency: "Agency listed by source",
    arrestingOfficer: "Officer listed by source",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    sourceUrl: "SOURCE-URL-HERE",
    sourceTimestamp: new Date().toISOString(),
    complianceNotes:
      "Reviewed local import. Charges are allegations. Presumed innocent unless proven guilty.",
    charges: [
      {
        offense: "Listed offense",
        statute: "STATUTE-HERE",
        chargeDescription: "Charge description from source",
        status: "Listed",
        caseNumber: "CASE-NUMBER-HERE",
        controlNumber: "CONTROL-NUMBER-HERE",
        displayOrder: 1,
      },
    ],
  };

  await fs.writeFile(templatePath, JSON.stringify(template, null, 2), "utf8");
  return templatePath;
}

async function copyImageToPublic(recordSlug: string, imageInfo: ImageInfo | null): Promise<string | undefined> {
  if (!imageInfo) return undefined;
  return copyBookingImageFromFile(recordSlug, imageInfo.extension, imageInfo.absolutePath);
}

async function createFacebookDraft(recordId: string, recordSlug: string, record: ReviewedRecord, imagePath?: string) {
  const existing = await prisma.facebookDraft.findFirst({
    where: {
      recordId,
    },
  });

  if (existing) return existing;

  const draftPayload = await createFacebookRecordDraftPayload(
    {
      slug: recordSlug,
      displayName: record.fullName,
      age: record.age,
      bookingDateTimeText: record.bookingDateTimeText ?? record.intakeDate,
      bookingTimeKnown: record.bookingTimeKnown,
      recordDate: record.intakeDate,
      arrestingAgency: record.arrestingAgency,
      sourceName: record.sourceName,
      imageUrl: imagePath ?? record.imageUrl,
      imageLocalPath: imagePath ?? record.imageLocalPath,
      charges: record.charges,
    },
    process.env.SITE_URL,
  );

  return prisma.facebookDraft.create({
    data: {
      recordId,
      status: "DRAFTED",
      scheduledFor: new Date(),
      ...draftPayload,
    },
  });
}

export async function importApprovedFolder(options: ImportOptions) {
  const folder = path.resolve(options.folder);

  if (!(await exists(folder))) {
    throw new Error(`Folder not found: ${folder}`);
  }

  const reviewedFile = await readReviewedRecord(folder);
  if (!reviewedFile) {
    const templatePath = await ensureRecordTemplate(folder);
    return {
      status: "missing_record_json" as const,
      message: `record.json or record.csv was missing. Created template: ${templatePath}`,
      templatePath,
    };
  }

  const record = normalizeRecord(reviewedFile);
  const booking = resolveBookingDate(record);

  const combined = JSON.stringify(record);
  if (hasAddressLikeText(combined)) {
    throw new Error(
      "Address-like data detected in record.json. Remove home/address fields before importing.",
    );
  }

  const hash = chargeHash(record.charges);
  const key = dedupeKey(record);
  const datePart = record.intakeDate
    ? record.intakeDate.replace(/[^0-9]/g, "").slice(0, 8)
    : new Date().toISOString().slice(0, 10).replace(/-/g, "");

  const recordSlug = slugify(`${record.fullName}-${datePart}`);
  const imageInfo = await findImageFile(folder);
  const copiedImagePath = await copyImageToPublic(recordSlug, imageInfo);

  const existing = await prisma.publicRecordDemo.findFirst({
    where: {
      OR: [
        ...(record.sourceRecordId ? [{ sourceRecordId: record.sourceRecordId }] : []),
        { slug: recordSlug },
        { sourceUrl: record.sourceUrl },
      ],
    },
  });

  if (existing) {
    return {
      status: "skipped_duplicate" as const,
      id: existing.id,
      slug: existing.slug,
      duplicateKey: key,
      chargeHash: hash,
    };
  }

  const publishStatus = options.autoPublish ? "PUBLISHED" : "DRAFT";
  const facebookPostStatus =
    options.createFacebookDraft && options.autoPublish ? "DRAFTED" : "NOT_QUEUED";

  const created = await prisma.publicRecordDemo.create({
    data: {
      slug: recordSlug,
      displayName: record.fullName,
      age: record.age,
      gender: record.gender,
      city: record.city,
      arrestingAgency: record.arrestingAgency,
      arrestingOfficer: record.arrestingOfficer,
      county: record.countyArrested,
      state: record.state,
      sourceRecordId: record.sourceRecordId,
      bookingDateTimeText: booking.bookingDateTimeText,
      bookingDate: booking.bookingDate,
      bookingTimeKnown: booking.bookingTimeKnown,
      recordDate: booking.recordDate,
      status: record.status,
      sourceName: record.sourceName,
      sourceUrl: record.sourceUrl,
      sourceTimestamp: new Date(record.sourceTimestamp || new Date().toISOString()),
      imageUrl: copiedImagePath || record.imageUrl,
      imageLocalPath: copiedImagePath || record.imageLocalPath,
      publishStatus,
      facebookPostStatus,
      complianceNotes: [
        record.complianceNotes,
        `Imported through reviewed local folder automation.`,
        `duplicateKey: ${key}`,
        `chargeHash: ${hash}`,
        `autoPublish: ${String(Boolean(options.autoPublish))}`,
        `facebookDraftRequested: ${String(Boolean(options.createFacebookDraft))}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
      charges: {
        create: record.charges.map((charge, index) => ({
          offense: charge.offense ?? charge.chargeDescription,
          statute: charge.statute,
          chargeDescription: charge.chargeDescription,
          caseNumber: charge.caseNumber,
          displayOrder: charge.displayOrder ?? index + 1,
        })),
      },
    },
  });

  let facebookDraftId: string | undefined;

  if (options.createFacebookDraft && options.autoPublish) {
    const draft = await createFacebookDraft(created.id, created.slug, record, copiedImagePath);
    facebookDraftId = draft.id;
  }

  return {
    status: "created" as const,
    id: created.id,
    slug: created.slug,
    publishStatus,
    facebookPostStatus,
    imagePath: copiedImagePath,
    duplicateKey: key,
    chargeHash: hash,
    facebookDraftId,
  };
}
