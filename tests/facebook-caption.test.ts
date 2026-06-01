import { describe, expect, it } from "vitest";
import { createFacebookRecordCaption } from "../src/lib/facebook-record-caption";
import { createFacebookRoundupCaption, facebookRecordUrl, facebookRoundupUrl } from "../src/lib/facebook-links";

const publicUrl = "https://bigsandycrimewatch.com/records/example-record";

describe("Facebook record captions", () => {
  it("uses a short teaser instead of listing multiple charges", () => {
    const caption = createFacebookRecordCaption(
      {
        displayName: "Example Person",
        age: 33,
        recordDate: "2026-06-01T12:30:00.000Z",
        arrestingAgency: "Example Agency",
        arrestingOfficer: "Officer Example",
        charges: [
          { offense: "First category", chargeDescription: "First full charge description" },
          { offense: "Second category", chargeDescription: "Second full charge description" },
        ],
      },
      publicUrl,
    );

    expect(caption).toContain("BIG SANDY REGIONAL BOOKING UPDATE");
    expect(caption).not.toContain("BIG SANDY AREA");
    expect(caption).toContain("Example Person");
    expect(caption).toContain("Age: 33");
    expect(caption).toContain("Arresting agency: Example Agency");
    expect(caption).toContain("Arresting officer: Officer Example");
    expect(caption).toContain(`Booking details, county, and full charge list: ${publicUrl}`);
    expect(caption).not.toContain("First full charge description");
    expect(caption).not.toContain("Second full charge description");
  });

  it("links to the full details without dumping a single charge description", () => {
    const caption = createFacebookRecordCaption(
      {
        displayName: "Example Person",
        charges: [{ offense: "Example category", chargeDescription: "Full single charge text" }],
      },
      publicUrl,
    );

    expect(caption).toContain(`Full booking details and charges available on the website: ${publicUrl}`);
    expect(caption).not.toContain("Full single charge text");
    expect(caption).toContain(
      "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.",
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
