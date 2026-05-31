import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    return new NextResponse("Admin authentication is not configured.", { status: 503 });
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Basic ")) {
    try {
      const [email, password] = atob(authorization.slice(6)).split(":");
      if (email === adminEmail && password === adminPassword) {
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
