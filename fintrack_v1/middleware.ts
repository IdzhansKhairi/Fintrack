import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE_NAME = "session_token";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Public routes - always allow
  if (path === "/login" || path === "/unauthorized" || path === "/") {
    return NextResponse.next();
  }

  // Allow API auth endpoints
  if (path.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  // Check for session token
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    // No session - redirect to login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Validate session by calling our session API
  try {
    const sessionResponse = await fetch(
      new URL("/api/auth/session", request.url),
      {
        headers: {
          Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      }
    );

    if (!sessionResponse.ok) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const sessionData = await sessionResponse.json();

    if (!sessionData.user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    // All authenticated users can access all dashboard routes
    // Add no-cache headers to all protected routes
    const response = NextResponse.next();
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate"
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    return response;
  } catch (error) {
    console.error("Middleware session validation error:", error);
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
