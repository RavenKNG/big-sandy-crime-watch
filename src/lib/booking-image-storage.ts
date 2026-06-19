import fs from "node:fs/promises";
import path from "node:path";

const BOOKING_IMAGE_URL_PREFIX = "/booking-images/";

function configuredStorageRoot() {
  return process.env.BOOKING_IMAGE_STORAGE_DIR || "./public/booking-images";
}

export function bookingImageStorageRoot() {
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), configuredStorageRoot());
}

export function bookingImagePublicPath(recordSlug: string, extension: string) {
  return `${BOOKING_IMAGE_URL_PREFIX}${recordSlug}/mugshot${extension}`;
}

export function bookingGeneratedImagePublicPath(
  recordSlug: string,
  kind: "preview" | "full",
  extension = ".png",
) {
  return `${BOOKING_IMAGE_URL_PREFIX}${recordSlug}/booking-card-${kind}${extension}`;
}

export function bookingCatchUpAssetPublicPath(dayKey: string, filename: string) {
  return `${BOOKING_IMAGE_URL_PREFIX}booking-catchup/${dayKey}/${filename}`;
}

export function bookingImageAbsolutePathFromPublicPath(publicPath: string) {
  if (!publicPath.startsWith(BOOKING_IMAGE_URL_PREFIX)) return undefined;
  const relativePath = publicPath.slice(BOOKING_IMAGE_URL_PREFIX.length);
  const normalized = path.posix.normalize(relativePath);
  if (!normalized || normalized.startsWith("..") || normalized.includes("\0")) return undefined;
  return path.join(bookingImageStorageRoot(), ...normalized.split("/"));
}

export function bookingImageLegacyAbsolutePathFromPublicPath(publicPath: string) {
  if (!publicPath.startsWith(`${BOOKING_IMAGE_URL_PREFIX}booking-catchup/`)) return undefined;
  const oldFolder = `daily-${"re"}${"caps"}`;
  return bookingImageAbsolutePathFromPublicPath(publicPath.replace(`${BOOKING_IMAGE_URL_PREFIX}booking-catchup/`, `${BOOKING_IMAGE_URL_PREFIX}${oldFolder}/`));
}

export async function bookingImageExists(publicPath?: string | null) {
  if (!publicPath) return false;
  const absolutePath = bookingImageAbsolutePathFromPublicPath(publicPath);
  if (!absolutePath) return false;
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureBookingImageDirectory(recordSlug: string) {
  const directory = path.join(bookingImageStorageRoot(), recordSlug);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function ensureBookingCatchUpDirectory(dayKey: string) {
  const directory = path.join(bookingImageStorageRoot(), "booking-catchup", dayKey);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function copyBookingImageFromFile(
  recordSlug: string,
  extension: ".jpg" | ".png" | ".webp",
  sourcePath: string,
) {
  const directory = await ensureBookingImageDirectory(recordSlug);
  const destination = path.join(directory, `mugshot${extension}`);
  await fs.copyFile(sourcePath, destination);
  return bookingImagePublicPath(recordSlug, extension);
}

export async function writeBookingImageFromBuffer(
  recordSlug: string,
  extension: ".jpg" | ".png" | ".webp",
  bytes: Uint8Array,
) {
  const directory = await ensureBookingImageDirectory(recordSlug);
  const destination = path.join(directory, `mugshot${extension}`);
  await fs.writeFile(destination, bytes);
  return bookingImagePublicPath(recordSlug, extension);
}

export async function writeBookingGeneratedImageFromBuffer(
  recordSlug: string,
  kind: "preview" | "full",
  bytes: Uint8Array,
) {
  const directory = await ensureBookingImageDirectory(recordSlug);
  const destination = path.join(directory, `booking-card-${kind}.png`);
  await fs.writeFile(destination, bytes);
  return bookingGeneratedImagePublicPath(recordSlug, kind);
}

export async function writeBookingCatchUpAssetFromBuffer(dayKey: string, filename: string, bytes: Uint8Array) {
  const directory = await ensureBookingCatchUpDirectory(dayKey);
  const destination = path.join(directory, filename);
  await fs.writeFile(destination, bytes);
  return bookingCatchUpAssetPublicPath(dayKey, filename);
}
