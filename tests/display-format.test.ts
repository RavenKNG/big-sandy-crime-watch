import { describe, expect, it } from "vitest";
import {
  countySlug,
  formatBookingDateTime,
  formatCountyLabel,
  formatCountyName,
} from "../src/lib/display-format";

describe("display formatting", () => {
  it("normalizes county casing for display and links", () => {
    expect(formatCountyName("JOHNSON County")).toBe("Johnson");
    expect(formatCountyLabel("johnson")).toBe("Johnson County");
    expect(formatCountyLabel("Rowan County")).toBe("Rowan County");
    expect(countySlug("ROWAN County")).toBe("rowan");
  });

  it("hides placeholder midnight times", () => {
    expect(formatBookingDateTime("2026-06-03T00:00:00.000Z", false)).toBe("June 3, 2026");
    expect(formatBookingDateTime("06/03/2026 00:00:00", true)).toBe("June 3, 2026");
    expect(formatBookingDateTime("06/03/2026 12:00 AM", true)).toBe("June 3, 2026");
  });

  it("keeps real times in a readable format", () => {
    expect(formatBookingDateTime("06/03/2026 14:45:00", true)).toBe("June 3, 2026 at 2:45 PM");
  });
});
