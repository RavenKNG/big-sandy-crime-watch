import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.DATABASE_URL ||= "postgresql://test:test@localhost:5432/test";
});

describe("reviewed official-source ingestion", () => {
  it("parses repeated CSV charge rows into one reviewed record", async () => {
    const { parseReviewedCsv } = await import("../src/lib/approved-imports");
    const csv = [
      "fullName,age,city,countyArrested,state,intakeDate,bookingDateTimeText,bookingTimeKnown,sourceRecordId,sourceName,sourceUrl,sourceTimestamp,offense,statute,chargeDescription",
      "Reviewed Person,31,Paintsville,Johnson,KY,2026-06-01T08:45:00-04:00,June 1 2026 8:45 AM,true,OFFICIAL-1,Official roster,https://example.test/record/1,2026-06-01T09:00:00-04:00,First offense,KRS-1,First listed charge",
      "Reviewed Person,31,Paintsville,Johnson,KY,2026-06-01T08:45:00-04:00,June 1 2026 8:45 AM,true,OFFICIAL-1,Official roster,https://example.test/record/1,2026-06-01T09:00:00-04:00,Second offense,KRS-2,Second listed charge",
    ].join("\n");
    const record = parseReviewedCsv(csv);

    expect(record.sourceRecordId).toBe("OFFICIAL-1");
    expect(record.bookingDateTimeText).toBe("June 1 2026 8:45 AM");
    expect(record.charges).toHaveLength(2);
  });

  it("preserves original date text and marks missing times", async () => {
    const { resolveBookingDate } = await import("../src/lib/approved-imports");
    const booking = resolveBookingDate({
      intakeDate: "2026-06-01",
      bookingDateTimeText: "June 1, 2026",
    });

    expect(booking.bookingDateTimeText).toBe("June 1, 2026");
    expect(booking.bookingTimeKnown).toBe(false);
    expect(booking.bookingDate.getUTCHours()).toBe(0);
  });

  it("uses the Eastern calendar day for the public today page", async () => {
    const { todayBounds } = await import("../src/lib/record-display");
    expect(todayBounds(new Date("2026-06-01T02:00:00.000Z")).start.toISOString()).toBe(
      "2026-05-31T00:00:00.000Z",
    );
  });

  it("orders booking day, known time, timestamp, then name", async () => {
    const { publishedRecordOrder } = await import("../src/lib/record-display");
    expect(publishedRecordOrder).toEqual([
      { bookingDate: "desc" },
      { bookingTimeKnown: "desc" },
      { recordDate: "desc" },
      { displayName: "asc" },
    ]);
  });
});
