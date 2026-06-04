import { formatBookingDateTime, formatCountyLabel } from "./display-format";

type CaptionCharge = {
  offense?: string | null;
  chargeDescription: string;
};

export type FacebookRecordCaption = {
  displayName: string;
  age?: number | null;
  county?: string | null;
  recordDate?: Date | string | null;
  arrestingAgency?: string | null;
  arrestingOfficer?: string | null;
  sourceName?: string | null;
  charges: CaptionCharge[];
};

const innocenceNotice =
  "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.";

function chargeTeaser(charges: CaptionCharge[], publicUrl: string): string {
  if (
    charges.length === 0 ||
    charges.every((charge) => charge.chargeDescription.includes("Charges unavailable from source"))
  ) {
    return `Booking details available on the website: ${publicUrl}`;
  }
  if (charges.length > 1) {
    return `Booking details, county, and full charge list: ${publicUrl}`;
  }

  return `Full booking details and charges available on the website: ${publicUrl}`;
}

export function createFacebookRecordCaption(
  record: FacebookRecordCaption,
  publicUrl: string,
): string {
  const bookingDate = formatBookingDateTime(record.recordDate, true);
  const countyLabel = formatCountyLabel(record.county);
  const sourceLead = countyLabel
    ? `New public record added for ${countyLabel} from ${record.sourceName ?? "the public source"}.`
    : `New public record added from ${record.sourceName ?? "the public source"}.`;

  return [
    "PUBLIC RECORD UPDATE",
    "",
    sourceLead,
    "",
    record.displayName,
    record.age ? `Age: ${record.age}` : undefined,
    bookingDate ? `Booking date: ${bookingDate}` : undefined,
    record.arrestingAgency ? `Arresting agency: ${record.arrestingAgency}` : undefined,
    record.arrestingOfficer ? `Arresting officer: ${record.arrestingOfficer}` : undefined,
    "",
    chargeTeaser(record.charges, publicUrl),
    "",
    innocenceNotice,
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}
