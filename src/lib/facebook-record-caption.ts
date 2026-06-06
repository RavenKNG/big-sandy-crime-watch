import { formatBookingDateTime } from "./display-format";

type CaptionCharge = {
  offense?: string | null;
  chargeDescription: string;
};

export type FacebookRecordCaption = {
  displayName: string;
  age?: number | null;
  county?: string | null;
  bookingDateTimeText?: Date | string | null;
  bookingTimeKnown?: boolean | null;
  recordDate?: Date | string | null;
  arrestingAgency?: string | null;
  arrestingOfficer?: string | null;
  sourceName?: string | null;
  charges: CaptionCharge[];
};

const innocenceNotice = "An arrest does not imply guilt. All individuals are presumed innocent unless proven guilty in court.";

export function createFacebookRecordCaption(
  record: FacebookRecordCaption,
  publicUrl: string,
): string {
  const bookingDate =
    formatBookingDateTime(record.bookingDateTimeText, record.bookingTimeKnown) ||
    formatBookingDateTime(record.recordDate, record.bookingTimeKnown) ||
    "Not listed";
  const agency = record.arrestingAgency || record.sourceName || "Not listed";

  return [
    `🚨 BOOKING REPORT: ${record.displayName}${record.age != null ? `, ${record.age}` : ""}`,
    `📅 Booked: ${bookingDate}`,
    `🏛️ Agency: ${agency}`,
    "",
    "Full charges & details:",
    publicUrl,
    "",
    innocenceNotice,
  ]
    .join("\n");
}
