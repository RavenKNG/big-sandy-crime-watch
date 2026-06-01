const siteUrl = (site = "https://bigsandycrimewatch.com") => site.replace(/\/$/, "");

export function facebookRecordUrl(slug: string, site?: string) {
  const url = new URL(`/records/${slug}`, `${siteUrl(site)}/`);
  url.search = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: "booking_update",
    utm_content: "record",
  }).toString();
  return url.toString();
}

export function facebookRoundupUrl(type: "today" | "last_72_hours", site?: string) {
  const url = new URL(type === "today" ? "/today" : "/last-72-hours", `${siteUrl(site)}/`);
  url.search = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: "booking_roundup",
    utm_content: type,
  }).toString();
  return url.toString();
}

const innocenceNotice =
  "Charges are allegations. Individuals are presumed innocent unless proven guilty in court.";

export function createFacebookRoundupCaption(type: "today" | "last_72_hours", site?: string) {
  if (type === "today") {
    return [
      "BIG SANDY REGIONAL BOOKING ROUNDUP",
      "",
      "New public booking records were added today.",
      "",
      `View today's bookings: ${facebookRoundupUrl(type, site)}`,
      "",
      innocenceNotice,
    ].join("\n");
  }

  return [
    "LAST 72 HOURS: BIG SANDY BOOKING UPDATES",
    "",
    "Recent public booking records are available for the Big Sandy region.",
    "",
    `View records: ${facebookRoundupUrl(type, site)}`,
    "",
    innocenceNotice,
  ].join("\n");
}
