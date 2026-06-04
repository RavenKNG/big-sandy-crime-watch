export const ROWAN_COUNTY_SLUG = "rowan";
export const ROWAN_SOURCE_SLUG = "rowan-county-detention-center";
export const ROWAN_PAGE_TITLE = "Rowan County Detention Center Inmates";
export const ROWAN_JAILTRACKER_URL =
  "https://omsweb.public-safety-cloud.com/jtclientweb/jailtracker/index/Rowan_County_KY";

export function isRowanCounty(value?: string | null) {
  return value?.trim().toLowerCase() === ROWAN_COUNTY_SLUG;
}
