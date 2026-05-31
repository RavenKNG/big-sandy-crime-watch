import type { ImportWarning, NormalizedPublicRecord } from "./official-record-types";
import { hasAddressLikeData, validateNormalizedRecord } from "./official-record-types";

export type MappingReport = {
  mode: "DRY_RUN_ONLY";
  sourceName: string;
  fromDate: string;
  toDate: string;
  generatedAt: string;
  rowsFound: number;
  detailPagesDetected: number;
  mappedFields: string[];
  missingFields: string[];
  chargeRows: number;
  chargeRowsWithDescription: number;
  chargeRowsWithStatute: number;
  imageStatus: "reference_detected_not_loaded" | "no_image_reference";
  warnings: ImportWarning[];
  databaseWrites: false;
  publicPublishing: false;
  facebookQueueCreated: false;
};

const reportFields: Array<keyof NormalizedPublicRecord> = [
  "fullName", "age", "gender", "status", "intakeDate", "releaseDate",
  "offenderId", "permanentId", "arrestingAgency", "arrestingOfficer",
  "countyArrested", "sourceName", "sourceUrl", "sourceTimestamp",
  "bookingImageUrl", "bookingImageLocalPath", "charges",
];

function redactText(value: string | undefined) {
  if (!value) return value;
  return hasAddressLikeData(value) ? "[REDACTED_ADDRESS_LIKE_DATA]" : value;
}

export function sanitizeMappingSample(record: NormalizedPublicRecord): NormalizedPublicRecord {
  return {
    fullName: "[REDACTED_NAME]",
    age: record.age,
    gender: record.gender,
    race: record.race,
    status: redactText(record.status),
    intakeDate: record.intakeDate,
    releaseDate: record.releaseDate,
    offenderId: record.offenderId ? "[REDACTED_ID]" : undefined,
    permanentId: record.permanentId ? "[REDACTED_ID]" : undefined,
    arrestingAgency: redactText(record.arrestingAgency),
    arrestingOfficer: record.arrestingOfficer ? "[REDACTED_OFFICER]" : undefined,
    countyArrested: record.countyArrested,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    sourceTimestamp: record.sourceTimestamp,
    bookingImageUrl: record.bookingImageUrl ? "[IMAGE_REFERENCE_PRESENT_NOT_STORED]" : undefined,
    bookingImageLocalPath: record.bookingImageLocalPath ? "[IMAGE_PATH_PRESENT_NOT_STORED]" : undefined,
    complianceNotes: "DRY_RUN_ONLY. Charges are allegations. Individuals are presumed innocent unless proven guilty in court.",
    charges: record.charges.map((charge) => ({
      ...charge,
      caseNumber: charge.caseNumber ? "[REDACTED_CASE_NUMBER]" : undefined,
      controlNumber: charge.controlNumber ? "[REDACTED_CONTROL_NUMBER]" : undefined,
      chargeDescription: redactText(charge.chargeDescription) || "",
    })),
  };
}

export function createMappingReport(records: NormalizedPublicRecord[], fromDate: string, toDate: string): MappingReport {
  const mappedFields = reportFields.filter((field) => records.some((record) => {
    const value = record[field];
    return Array.isArray(value) ? value.length > 0 : value !== undefined && value !== "";
  }));
  const chargeRows = records.flatMap((record) => record.charges);
  return {
    mode: "DRY_RUN_ONLY",
    sourceName: "BSRDC reviewed source snapshot",
    fromDate,
    toDate,
    generatedAt: new Date().toISOString(),
    rowsFound: records.length,
    detailPagesDetected: new Set(records.map((record) => record.sourceUrl).filter(Boolean)).size,
    mappedFields,
    missingFields: reportFields.filter((field) => !mappedFields.includes(field)),
    chargeRows: chargeRows.length,
    chargeRowsWithDescription: chargeRows.filter((charge) => Boolean(charge.chargeDescription)).length,
    chargeRowsWithStatute: chargeRows.filter((charge) => Boolean(charge.statute)).length,
    imageStatus: records.some((record) => record.bookingImageUrl || record.bookingImageLocalPath) ? "reference_detected_not_loaded" : "no_image_reference",
    warnings: records.flatMap(validateNormalizedRecord),
    databaseWrites: false,
    publicPublishing: false,
    facebookQueueCreated: false,
  };
}
