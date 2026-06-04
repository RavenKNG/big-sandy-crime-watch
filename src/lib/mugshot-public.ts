import fs from "node:fs/promises";
import path from "node:path";
import { absoluteSiteUrl } from "./display-format";
import { bookingImageAbsolutePathFromPublicPath } from "./booking-image-storage";

export const MUGSHOT_FALLBACK_PATH = "/media/mugshot";

function isMediaMugshotPathname(pathname: string) {
  return pathname.replace(/\/+$/, "") === "/media/mugshot";
}

function normalizeExistingProxyPath(src: string, site?: string) {
  if (src.startsWith("/media/mugshot")) {
    return new URL(src, absoluteSiteUrl("/", site)).toString();
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      if (isMediaMugshotPathname(url.pathname)) {
        return url.toString();
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function normalizeAbsoluteBookingImagePath(src: string) {
  if (!/^https?:\/\//i.test(src)) return undefined;

  try {
    const url = new URL(src);
    if (url.pathname.startsWith("/booking-images/")) {
      return url.pathname;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function publicMugshotUrl(src?: string | null, site?: string) {
  if (!src) {
    return absoluteSiteUrl(MUGSHOT_FALLBACK_PATH, site);
  }

  const existingProxy = normalizeExistingProxyPath(src, site);
  if (existingProxy) return existingProxy;
  const normalizedLocalPath = normalizeAbsoluteBookingImagePath(src);

  const url = new URL(MUGSHOT_FALLBACK_PATH, absoluteSiteUrl("/", site));
  url.searchParams.set("src", normalizedLocalPath ?? src);
  return url.toString();
}

export function publicMugshotPath(src?: string | null) {
  if (!src) return MUGSHOT_FALLBACK_PATH;

  if (src.startsWith("/media/mugshot")) return src;

  if (/^https?:\/\//i.test(src)) {
    try {
      const url = new URL(src);
      if (isMediaMugshotPathname(url.pathname)) {
        return `${url.pathname}${url.search}`;
      }
      if (url.pathname.startsWith("/booking-images/")) {
        return `/media/mugshot?src=${encodeURIComponent(url.pathname)}`;
      }
    } catch {
      // fall through and proxy below
    }
  }

  return `/media/mugshot?src=${encodeURIComponent(src)}`;
}

export async function mugshotSourceExists(src?: string | null) {
  if (!src) return false;

  const existingProxy = normalizeExistingProxyPath(src);
  if (existingProxy) return true;
  const normalizedLocalPath = normalizeAbsoluteBookingImagePath(src);
  if (normalizedLocalPath) {
    src = normalizedLocalPath;
  }

  if (/^https?:\/\//i.test(src)) {
    try {
      const response = await fetch(src, { method: "HEAD" });
      return response.ok;
    } catch {
      return false;
    }
  }

  const absolutePath = bookingImageAbsolutePathFromPublicPath(src);
  if (!absolutePath) return false;

  try {
    await fs.access(path.resolve(absolutePath));
    return true;
  } catch {
    return false;
  }
}
