type CaptionCharge = {
  offense?: string | null;
  chargeDescription: string;
};

export type FacebookRecordCaption = {
  displayName: string;
  age?: number | null;
  recordDate?: Date | string | null;
  arrestingAgency?: string | null;
  arrestingOfficer?: string | null;
  charges: CaptionCharge[];
};

const innocenceNotice =
  "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.";

function formatBookingDate(value?: Date | string | null): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function chargeTeaser(charges: CaptionCharge[], publicUrl: string): string {
  if (charges.length > 1) {
    return `Multiple charges listed. Full details: ${publicUrl}`;
  }

  return `Full charges and booking details available here: ${publicUrl}`;
}

export function createFacebookRecordCaption(
  record: FacebookRecordCaption,
  publicUrl: string,
): string {
  const bookingDate = formatBookingDate(record.recordDate);

  return [
    "BOOKING UPDATE - BIG SANDY AREA",
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
