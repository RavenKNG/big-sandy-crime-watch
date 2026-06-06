import { describe, expect, it } from "vitest";
import { createFacebookRecordCaption } from "../src/lib/facebook-record-caption";
import { createFacebookRoundupCaption, facebookRecordUrl, facebookRoundupUrl } from "../src/lib/facebook-links";

const publicUrl = "https://bigsandycrimewatch.com/records/example-record";

describe("Facebook record captions", () => {
  it("shows booking facts before click without listing multiple charges", () => {
    const caption = createFacebookRecordCaption(
      {
        displayName: "Example Person",
        age: 33,
        county: "Johnson",
        bookingDateTimeText: "2026-06-01T12:30:00.000Z",
        bookingTimeKnown: true,
        recordDate: "2026-06-01T12:30:00.000Z",
        arrestingAgency: "Example Agency",
        arrestingOfficer: "Officer Example",
        sourceName: "Big Sandy Regional Detention Center Public Roster",
        charges: [
          { offense: "First category", chargeDescription: "First full charge description" },
          { offense: "Second category", chargeDescription: "Second full charge description" },
        ],
      },
      publicUrl,
    );

    expect(caption).toContain("🚨 BOOKING REPORT: Example Person, 33");
    expect(caption).toContain("📅 Booked: June 1, 2026 at 8:30 AM");
    expect(caption).toContain("🏛️ Agency: Example Agency");
    expect(caption).toContain("Full charges & details:");
    expect(caption).toContain(publicUrl);
    expect(caption).not.toContain("Johnson County");
    expect(caption).not.toContain("Officer Example");
    expect(caption).not.toContain("First full charge description");
    expect(caption).not.toContain("Second full charge description");
  });

  it("links to the full details without dumping a single charge description", () => {
    const caption = createFacebookRecordCaption(
      {
        displayName: "Example Person",
        sourceName: "Big Sandy Regional Detention Center Public Roster",
        charges: [{ offense: "Example category", chargeDescription: "Full single charge text" }],
      },
      publicUrl,
    );

    expect(caption).toContain("🚨 BOOKING REPORT: Example Person");
    expect(caption).toContain("🏛️ Agency: Big Sandy Regional Detention Center Public Roster");
    expect(caption).toContain(publicUrl);
    expect(caption).not.toContain("Full single charge text");
    expect(caption).toContain(
      "An arrest does not imply guilt. All individuals are presumed innocent unless proven guilty in court.",
    );
  });

  it("adds consistent Facebook campaign tags to public record links", () => {
    expect(facebookRecordUrl("example-record")).toBe(
      "https://bigsandycrimewatch.com/records/example-record?utm_source=facebook&utm_medium=social&utm_campaign=booking_update&utm_content=record",
    );
  });

  it("creates careful non-posting roundup captions with tagged links", () => {
    const today = createFacebookRoundupCaption("today");
    const recent = createFacebookRoundupCaption("last_72_hours");
    expect(today).toContain("BIG SANDY REGIONAL BOOKING ROUNDUP");
    expect(today).toContain(facebookRoundupUrl("today"));
    expect(recent).toContain("LAST 72 HOURS: BIG SANDY BOOKING UPDATES");
    expect(recent).toContain(facebookRoundupUrl("last_72_hours"));
    expect(today).not.toContain("look who got caught");
  });
});
