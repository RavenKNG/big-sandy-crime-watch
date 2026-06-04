import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";

function timingSafeEqualText(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  if (leftBytes.length !== rightBytes.length) return false;
  return crypto.timingSafeEqual(leftBytes, rightBytes);
}

export function proxy(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return new NextResponse("Admin authentication is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const decoded = atob(authorization.slice(6));
      const separator = decoded.indexOf(":");
      const email = separator >= 0 ? decoded.slice(0, separator) : decoded;
      const password = separator >= 0 ? decoded.slice(separator + 1) : "";
      if (timingSafeEqualText(email, adminEmail) && timingSafeEqualText(password, adminPassword)) {
        return NextResponse.next();
      }
    } catch {
      // Invalid Basic Auth payloads fall through to the challenge response.
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Big Sandy Crime Watch Admin"' },
  });
}

export const config = {
  matcher: "/admin/:path*",
};
