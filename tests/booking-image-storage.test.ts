import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  bookingImageAbsolutePathFromPublicPath,
  bookingImageExists,
  bookingImagePublicPath,
  writeBookingImageFromBuffer,
} from "../src/lib/booking-image-storage";

const originalStorageDir = process.env.BOOKING_IMAGE_STORAGE_DIR;

afterEach(() => {
  process.env.BOOKING_IMAGE_STORAGE_DIR = originalStorageDir;
});

describe("booking image storage", () => {
  it("writes and resolves booking images from the configured storage root", async () => {
    const storageRoot = await fs.mkdtemp(path.join(os.tmpdir(), "bscw-booking-images-"));
    process.env.BOOKING_IMAGE_STORAGE_DIR = storageRoot;

    const publicPath = await writeBookingImageFromBuffer(
      "sample-record",
      ".jpg",
      Buffer.from("fake image bytes"),
    );

    expect(publicPath).toBe(bookingImagePublicPath("sample-record", ".jpg"));
    expect(await bookingImageExists(publicPath)).toBe(true);
    expect(bookingImageAbsolutePathFromPublicPath(publicPath)).toBe(
      path.join(storageRoot, "sample-record", "mugshot.jpg"),
    );
  });

  it("rejects traversal paths", () => {
    expect(bookingImageAbsolutePathFromPublicPath("/booking-images/../../etc/passwd")).toBeUndefined();
  });
});
