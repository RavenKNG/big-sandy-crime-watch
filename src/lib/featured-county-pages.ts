export const FEATURED_COUNTY_PAGES = {
  rowan: {
    countySlug: "rowan",
    sourceSlug: "rowan-county-detention-center",
    pageTitle: "Rowan County Detention Center Inmates",
    sourceName: "Rowan County Detention Center",
    lookupUrl:
      "https://omsweb.public-safety-cloud.com/jtclientweb/jailtracker/index/Rowan_County_KY",
    lookupButtonText: "Open Rowan County JailTracker Inmate Lookup",
    description:
      "Use Big Sandy Crime Watch to access the official Rowan County Detention Center inmate lookup and current JailTracker instructions.",
    intro:
      "Looking for Rowan County Detention Center inmates? This page links to the official Rowan County JailTracker lookup for current inmates, mugshots, booking information, charges, and bond details when listed.",
    notice:
      "Rowan JailTracker may ask for a short verification code before showing current inmates.",
    emptyState:
      "No locally imported Rowan records are published here yet. Use the official Rowan JailTracker lookup above.",
    searchLabel: "Search Rowan on site",
  },
  pike: {
    countySlug: "pike",
    sourceSlug: "pike-county-detention-center",
    pageTitle: "Pike County Detention Center Inmates",
    sourceName: "Pike County Detention Center",
    lookupUrl: "http://www.pikecountydetention.com/PikeCounty_InmateList.html",
    lookupButtonText: "Open Pike County Detention Center Inmate Lookup",
    description:
      "Use Big Sandy Crime Watch to access the official Pike County Detention Center inmate roster and current booking lookup instructions.",
    intro:
      "Looking for Pike County Detention Center inmates? This page links to the official Pike County inmate roster for current inmates, mugshots, booking information, charges, and related detention details when listed.",
    notice:
      "Pike County Detention Center roster details are provided by the official source and may change throughout the day.",
    emptyState:
      "No locally imported Pike records are published here yet. Use the official Pike County Detention Center inmate lookup above.",
    searchLabel: "Search Pike on site",
  },
} as const;

export type FeaturedCountySlug = keyof typeof FEATURED_COUNTY_PAGES;

export function getFeaturedCountyPage(county?: string | null) {
  if (!county) return null;
  const slug = county.trim().toLowerCase() as FeaturedCountySlug;
  return FEATURED_COUNTY_PAGES[slug] ?? null;
}

export function isFeaturedCountyPage(county?: string | null) {
  return Boolean(getFeaturedCountyPage(county));
}
