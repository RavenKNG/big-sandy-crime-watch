import fs from "node:fs/promises";
import { NextResponse } from "next/server";
import { bookingImageAbsolutePathFromPublicPath } from "@/lib/booking-image-storage";

const contentTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const pathSegments = (await params).path;
  const publicPath = `/booking-images/${pathSegments.join("/")}`;
  const absolutePath = bookingImageAbsolutePathFromPublicPath(publicPath);
  if (!absolutePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const file = await fs.readFile(absolutePath);
    const extension = absolutePath.slice(absolutePath.lastIndexOf(".")).toLowerCase();
    return new NextResponse(file, {
      status: 200,
      headers: {
        "Content-Type": contentTypes.get(extension) || "application/octet-stream",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
