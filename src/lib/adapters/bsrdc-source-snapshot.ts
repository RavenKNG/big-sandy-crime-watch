import { normalizeNameParts, normalizeText, parseNumber, type NormalizedCharge, type NormalizedPublicRecord } from "./official-record-types";

type SnapshotRow = Record<string, unknown>;
const text = (row: SnapshotRow, ...keys: string[]) => keys.map((key) => normalizeText(row[key])).find(Boolean);

function mapCharge(value: unknown, displayOrder: number): NormalizedCharge {
  const row = (value && typeof value === "object" ? value : {}) as SnapshotRow;
  return {
    offense: text(row, "offense", "charge", "chargeName"),
    arrestCode: text(row, "arrestCode", "code"),
    statute: text(row, "statute", "statuteNumber"),
    chargeDescription: text(row, "chargeDescription", "description", "offense", "charge") || "",
    status: text(row, "status", "chargeStatus"),
    caseNumber: text(row, "caseNumber", "case"),
    controlNumber: text(row, "controlNumber", "control"),
    displayOrder,
  };
}

export function mapBsrdcSourceRow(value: unknown): NormalizedPublicRecord {
  const row = (value && typeof value === "object" ? value : {}) as SnapshotRow;
  const fullName = text(row, "fullName", "name", "inmateName", "offenderName") || "";
  const sourceUrl = text(row, "sourceUrl", "detailUrl", "url") || "";
  const rawCharges = Array.isArray(row.charges) ? row.charges : Array.isArray(row.chargeRows) ? row.chargeRows : [];
  return {
    ...normalizeNameParts(fullName),
    fullName,
    age: parseNumber(row.age),
    gender: text(row, "gender", "sex"),
    race: text(row, "race"),
    status: text(row, "status", "bookingStatus"),
    intakeDate: text(row, "intakeDate", "bookedAt", "bookingDate"),
    releaseDate: text(row, "releaseDate", "releasedAt"),
    offenderId: text(row, "offenderId", "offenderNumber"),
    permanentId: text(row, "permanentId", "permanentNumber"),
    arrestingAgency: text(row, "arrestingAgency", "agency"),
    arrestingOfficer: text(row, "arrestingOfficer", "officer"),
    countyArrested: text(row, "countyArrested", "county"),
    sourceName: text(row, "sourceName") || "BSRDC human-reviewed local snapshot",
    sourceUrl,
    sourceTimestamp: text(row, "sourceTimestamp", "fetchedAt", "snapshotTimestamp") || "",
    bookingImageUrl: text(row, "bookingImageUrl", "imageUrl", "mugshotUrl"),
    complianceNotes: "DRY_RUN_ONLY local snapshot mapping. Charges are allegations. Individuals are presumed innocent unless proven guilty in court.",
    charges: rawCharges.map(mapCharge),
  };
}

export function mapBsrdcSourceSnapshot(value: unknown): NormalizedPublicRecord[] {
  const rows = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as SnapshotRow).records) ? (value as SnapshotRow).records as unknown[] : [];
  return rows.map(mapBsrdcSourceRow);
}

export function inferSnapshotRange(records: NormalizedPublicRecord[]) {
  const dates = records.map((record) => record.intakeDate).filter((value): value is string => Boolean(value)).sort();
  return { fromDate: dates[0] || "unknown", toDate: dates.at(-1) || "unknown" };
}
