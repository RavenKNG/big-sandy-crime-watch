import fs from "node:fs/promises";
import path from "node:path";
import {
  bookingImageAbsolutePathFromPublicPath,
} from "./booking-image-storage";

export type BookingPhotoStatus = "available" | "unavailable" | "pending" | "failed";

export type BookingPhotoRecord = {
  slug: string;
  imageUrl?: string | null;
  imageLocalPath?: string | null;
  complianceNotes?: string | null;
};

export type BookingPhotoResolution = {
  status: BookingPhotoStatus;
  imagePathOrUrl: string | null;
  reason: string;
  checkedSource: string | null;
  localAbsolutePath: string | null;
};

type BookingPhotoStatusHint = {
  status: "pending" | "failed";
  reason: string | null;
};

const PHOTO_STATUS_PREFIX = "photoPipelineStatus:";
const PHOTO_REASON_PREFIX = "photoPipelineReason:";

function normalizeText(value?: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function normalizeStoredSource(src?: string | null) {
  const normalized = normalizeText(src);
  if (!normalized) return undefined;

  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      if (url.pathname.startsWith("/booking-images/")) {
        return url.pathname;
      }
    } catch {
      return normalized;
    }
  }

  return normalized;
}

function uniqueCandidates(record: BookingPhotoRecord) {
  return [...new Set([record.imageLocalPath, record.imageUrl].map(normalizeStoredSource))].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
}

async function localPathExists(publicPath: string) {
  const absolutePath = bookingImageAbsolutePathFromPublicPath(publicPath);
  if (!absolutePath) return { exists: false, absolutePath: null as string | null };

  try {
    await fs.access(path.resolve(absolutePath));
    return { exists: true, absolutePath };
  } catch {
    return { exists: false, absolutePath };
  }
}

async function remoteSourceExists(src: string) {
  try {
    const response = await fetch(src, { method: "HEAD" });
    if (response.ok) return true;

    if (response.status === 405 || response.status === 501) {
      const retry = await fetch(src, { method: "GET" });
      return retry.ok;
    }
  } catch {
    return false;
  }

  return false;
}

function readStatusHint(notes?: string | null): BookingPhotoStatusHint | null {
  if (!notes) return null;

  const lines = notes.split(/\r?\n/);
  const status = lines
    .find((line) => line.startsWith(PHOTO_STATUS_PREFIX))
    ?.slice(PHOTO_STATUS_PREFIX.length)
    .trim();
  const reason = lines
    .find((line) => line.startsWith(PHOTO_REASON_PREFIX))
    ?.slice(PHOTO_REASON_PREFIX.length)
    .trim();

  if (status !== "pending" && status !== "failed") return null;
  return {
    status,
    reason: reason || null,
  };
}

function stripStatusHint(notes?: string | null) {
  const cleaned = (notes ?? "")
    .split(/\r?\n/)
    .filter((line) => !line.startsWith(PHOTO_STATUS_PREFIX) && !line.startsWith(PHOTO_REASON_PREFIX))
    .join("\n")
    .trim();
  return cleaned || null;
}

export function withBookingPhotoStatusHint(
  notes: string | null | undefined,
  hint?: BookingPhotoStatusHint | null,
) {
  const base = stripStatusHint(notes);
  if (!hint) return base;

  return [
    base,
    `${PHOTO_STATUS_PREFIX} ${hint.status}`,
    `${PHOTO_REASON_PREFIX} ${hint.reason ?? (hint.status === "pending" ? "Awaiting confirmed mugshot availability." : "Stored mugshot reference is not currently usable.")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function resolveBookingPhoto(record: BookingPhotoRecord): Promise<BookingPhotoResolution> {
  const statusHint = readStatusHint(record.complianceNotes);
  const candidates = uniqueCandidates(record);

  for (const candidate of candidates) {
    if (candidate.startsWith("/booking-images/")) {
      const local = await localPathExists(candidate);
      if (local.exists) {
        return {
          status: "available",
          imagePathOrUrl: candidate,
          reason: "Confirmed local booking image file exists.",
          checkedSource: candidate,
          localAbsolutePath: local.absolutePath,
        };
      }
      continue;
    }

    if (/^https?:\/\//i.test(candidate)) {
      if (await remoteSourceExists(candidate)) {
        return {
          status: "available",
          imagePathOrUrl: candidate,
          reason: "Confirmed remote booking image URL is reachable.",
          checkedSource: candidate,
          localAbsolutePath: null,
        };
      }
    }
  }

  if (statusHint?.status === "pending") {
    return {
      status: "pending",
      imagePathOrUrl: null,
      reason: statusHint.reason ?? "Photo resolution is pending confirmation.",
      checkedSource: candidates[0] ?? null,
      localAbsolutePath: null,
    };
  }

  if (candidates.length > 0 || statusHint?.status === "failed") {
    return {
      status: "failed",
      imagePathOrUrl: null,
      reason:
        statusHint?.reason ??
        "Stored mugshot reference exists, but the image file or URL could not be confirmed.",
      checkedSource: candidates[0] ?? null,
      localAbsolutePath: null,
    };
  }

  return {
    status: "unavailable",
    imagePathOrUrl: null,
    reason: "Source record has no confirmed mugshot reference.",
    checkedSource: null,
    localAbsolutePath: null,
  };
}
