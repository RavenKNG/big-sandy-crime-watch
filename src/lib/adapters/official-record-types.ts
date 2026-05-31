export type NormalizedCharge = {
  offense?: string;
  arrestCode?: string;
  statute?: string;
  chargeDescription: string;
  status?: string;
  caseNumber?: string;
  controlNumber?: string;
  displayOrder: number;
};

export type NormalizedPublicRecord = {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName: string;
  age?: number;
  gender?: string;
  race?: string;
  status?: string;
  intakeDate?: string;
  releaseDate?: string;
  offenderId?: string;
  permanentId?: string;
  arrestingAgency?: string;
  arrestingOfficer?: string;
  countyArrested?: string;
  sourceName: string;
  sourceUrl: string;
  sourceTimestamp: string;
  bookingImageUrl?: string;
  bookingImageLocalPath?: string;
  complianceNotes?: string;
  charges: NormalizedCharge[];
};

export type ImportWarning = { code: string; message: string };
export type ImportResult = {
  sourceName: string;
  fromDate: string;
  toDate: string;
  fetchedAt: string;
  records: NormalizedPublicRecord[];
  warnings: ImportWarning[];
};
export type OfficialRecordAdapter = {
  sourceName: string;
  sourceUrl: string;
  enabled: boolean;
  fetchRange(fromDate: string, toDate: string): Promise<ImportResult>;
};

export function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : undefined;
}

export function parseNumber(value: unknown): number | undefined {
  const text = normalizeText(value);
  if (!text) return undefined;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeNameParts(fullName: string) {
  const parts = fullName.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : undefined, lastName: parts.at(-1) };
}

export function chargeHash(charges: NormalizedCharge[]) {
  return charges.map((charge) => [charge.offense, charge.arrestCode, charge.statute, charge.chargeDescription, charge.status, charge.caseNumber, charge.controlNumber].filter(Boolean).join("|").toLowerCase()).sort().join("::");
}

export function dedupeKey(record: NormalizedPublicRecord) {
  const identity = record.permanentId || record.offenderId;
  const primary = [identity, record.intakeDate].filter(Boolean).join("|");
  return (identity ? primary : [record.fullName, record.intakeDate, chargeHash(record.charges)].filter(Boolean).join("|")).toLowerCase();
}

export function hasAddressLikeData(text: string) {
  return /\b\d{2,6}\s+[A-Za-z0-9.'-]+\s+(street|st|road|rd|lane|ln|drive|dr|avenue|ave|court|ct|circle|cir|highway|hwy)\b/i.test(text);
}

export function validateNormalizedRecord(record: NormalizedPublicRecord) {
  const warnings: ImportWarning[] = [];
  if (!record.fullName) warnings.push({ code: "missing_name", message: "Record is missing fullName." });
  if (!record.sourceName || !record.sourceUrl || !record.sourceTimestamp) warnings.push({ code: "missing_source", message: "Record must include sourceName, sourceUrl, and sourceTimestamp." });
  if (!record.charges.length) warnings.push({ code: "missing_charges", message: "Record has no listed charges." });
  if (hasAddressLikeData(JSON.stringify(record))) warnings.push({ code: "address_like_data", message: "Record appears to contain address-like data. Do not publish home addresses." });
  return warnings;
}
