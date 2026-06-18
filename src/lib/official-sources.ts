export type OfficialSourceConfig = {
  slug: string;
  sourceName: string;
  sourceType: string;
  sourceUrl: string;
  facilityCounty: string;
  facilityCity?: string;
  regionLabel?: string;
  fetchMode: "publicroster-api" | "jtclientweb-captcha";
  agencyCode?: string;
  routeSlug?: string;
  automationEnabled: boolean;
  message?: string;
};

export const officialSources: OfficialSourceConfig[] = [
  {
    slug: "big-sandy-regional-detention-center",
    sourceName: "Big Sandy Regional Detention Center Public Roster",
    sourceType: "JailTracker / public-safety-cloud public roster",
    sourceUrl: "http://bsrdc.com/InmateRoster/BSRDC_inmatelist.html",
    facilityCounty: "Johnson",
    regionLabel: "Big Sandy",
    fetchMode: "publicroster-api",
    agencyCode: "BIGSANDYKYRDC",
    automationEnabled: true,
  },
  {
    slug: "rowan-county-detention-center",
    sourceName: "Rowan County Detention Center",
    sourceType: "JailTracker / public-safety-cloud JailTracker",
    sourceUrl: "https://omsweb.public-safety-cloud.com/jtclientweb/jailtracker/index/Rowan_County_KY",
    facilityCounty: "Rowan",
    facilityCity: "Morehead",
    regionLabel: "Eastern Kentucky / Gateway",
    fetchMode: "jtclientweb-captcha",
    routeSlug: "Rowan_County_KY",
    automationEnabled: false,
    message:
      "The public Rowan JailTracker route currently requires an interactive captcha challenge before offender data is returned. Safe unattended automation remains disabled until the vendor exposes a supported non-captcha feed.",
  },
];

export function findOfficialSourceBySlug(slug: string) {
  return officialSources.find((source) => source.slug === slug);
}

export function findOfficialSourceByName(sourceName?: string | null) {
  return officialSources.find((source) => source.sourceName === sourceName);
}

export function officialSourceRosterUrl(source: OfficialSourceConfig): string {
  if (source.slug === "big-sandy-regional-detention-center") {
    return process.env.OFFICIAL_SOURCE_URL || source.sourceUrl;
  }
  return source.sourceUrl;
}

export function officialSourceApiRoot() {
  return process.env.OFFICIAL_SOURCE_API_URL || "https://omsweb.public-safety-cloud.com/publicroster-api/api";
}

export function officialSourceApiHeaders() {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.OFFICIAL_SOURCE_API_KEY?.trim();
  if (apiKey) headers["X-API-KEY"] = apiKey;
  return headers;
}

export function automaticOfficialSources() {
  return officialSources.filter((source) => source.automationEnabled);
}
