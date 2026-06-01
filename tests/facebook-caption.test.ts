import { describe, expect, it } from "vitest";
import { createFacebookRecordCaption } from "../src/lib/facebook-record-caption";

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

    expect(caption).toContain("BOOKING UPDATE - BIG SANDY AREA");
    expect(caption).toContain("Example Person");
    expect(caption).toContain("Age: 33");
    expect(caption).toContain("Arresting agency: Example Agency");
    expect(caption).toContain("Arresting officer: Officer Example");
    expect(caption).toContain(`Multiple charges listed. Full details: ${publicUrl}`);
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

    expect(caption).toContain(`Full charges and booking details available here: ${publicUrl}`);
    expect(caption).not.toContain("Full single charge text");
    expect(caption).toContain(
      "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.",
    );
  });
});
