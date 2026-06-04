import { ROWAN_COUNTY_SLUG, ROWAN_JAILTRACKER_URL, ROWAN_PAGE_TITLE } from "./rowan";

export const ROWAN_LOOKUP_PROMO = "ROWAN_LOOKUP_PROMO";
export const ROWAN_PROMO_COOLDOWN_HOURS = 72;

const siteUrl = (site = "https://bigsandycrimewatch.com") => site.replace(/\/$/, "");

export function rowanLandingUrl(site?: string) {
  const url = new URL(`/county/${ROWAN_COUNTY_SLUG}`, `${siteUrl(site)}/`);
  url.search = new URLSearchParams({
    utm_source: "facebook",
    utm_medium: "social",
    utm_campaign: "rowan_lookup_promo",
    utm_content: "landing_page",
  }).toString();
  return url.toString();
}

export function createRowanPromoCaptions(site?: string) {
  const landingUrl = rowanLandingUrl(site);
  return [
    `Looking for Rowan County Detention Center inmates? We added a Rowan inmate lookup page with the official JailTracker link for current inmates, mugshots, bookings, and charges when available.\n\n${landingUrl}`,
    `Rowan County / Morehead KY: Need the current inmate lookup? Start here for the official Rowan JailTracker access and regional public record updates.\n\n${landingUrl}`,
    `We added a Rowan County Detention Center inmate lookup page. Use it to reach the official JailTracker search for current inmates, mugshots, booking info, charges, and bond details when listed.\n\n${landingUrl}`,
    `Rowan County Detention Center inmate lookup is now easier to find through Big Sandy Crime Watch. Official JailTracker access is linked on the page.\n\n${landingUrl}`,
    `Morehead / Rowan County: Find the official Rowan County Detention Center inmate lookup here. JailTracker may ask for a short verification code before showing current inmates.\n\n${landingUrl}`,
    `Need the official Rowan County Detention Center inmate lookup? We added a Rowan landing page that points straight to the current JailTracker search.\n\n${landingUrl}`,
    `Looking up Rowan County Detention Center inmates? Start with our Rowan page for the official JailTracker link and public-record context.\n\n${landingUrl}`,
  ];
}

export function createRowanPromoCaption(rotationIndex = 0, site?: string) {
  const captions = createRowanPromoCaptions(site);
  return captions[((rotationIndex % captions.length) + captions.length) % captions.length];
}

export function rowanPromoDraftMeta(site?: string) {
  return {
    type: ROWAN_LOOKUP_PROMO,
    pageTitle: ROWAN_PAGE_TITLE,
    landingUrl: rowanLandingUrl(site),
    externalUrl: ROWAN_JAILTRACKER_URL,
  };
}

export function isRowanPromoUrl(url?: string | null, site?: string) {
  return Boolean(url && url === rowanLandingUrl(site));
}

export function computeNextEligibleRowanPromoTime(lastPostedAt?: Date | null, now = new Date()) {
  if (!lastPostedAt) return now;
  return new Date(lastPostedAt.getTime() + ROWAN_PROMO_COOLDOWN_HOURS * 60 * 60 * 1000);
}

export function evaluateRowanPromoEligibility({
  enabled,
  pageExists,
  facebookHealthy,
  postingEnabled,
  queuedExists,
  lastPostedAt,
  now = new Date(),
}: {
  enabled: boolean;
  pageExists: boolean;
  facebookHealthy: boolean;
  postingEnabled: boolean;
  queuedExists: boolean;
  lastPostedAt?: Date | null;
  now?: Date;
}) {
  const nextEligibleAt = computeNextEligibleRowanPromoTime(lastPostedAt, now);

  if (!enabled) {
    return { eligible: false, reason: "ROWAN_PROMO_ENABLED is not true.", nextEligibleAt };
  }
  if (!pageExists) {
    return { eligible: false, reason: "Rowan landing page is not available.", nextEligibleAt };
  }
  if (!facebookHealthy) {
    return { eligible: false, reason: "Facebook token is unhealthy.", nextEligibleAt };
  }
  if (!postingEnabled) {
    return { eligible: false, reason: "FACEBOOK_POSTING_ENABLED is false.", nextEligibleAt };
  }
  if (queuedExists) {
    return { eligible: false, reason: "A Rowan promo draft is already queued.", nextEligibleAt };
  }
  if (lastPostedAt && now < nextEligibleAt) {
    return {
      eligible: false,
      reason: "A Rowan promo posted within the last 72 hours.",
      nextEligibleAt,
    };
  }

  return { eligible: true, reason: null, nextEligibleAt };
}
