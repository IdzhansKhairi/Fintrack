import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // 1. Base URL "/" -> redirect to /dashboard if authenticated, otherwise /login
  if (pathname === "/" || pathname === "/auth") {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = user ? "/dashboard" : "/login";
    return NextResponse.redirect(targetUrl);
  }

  // 2. Login page "/login" -> if already logged in, redirect straight to /dashboard
  if (pathname === "/login") {
    if (user) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = "/dashboard";
      return NextResponse.redirect(targetUrl);
    }
    return supabaseResponse;
  }

  // 3. Any other protected route -> if not logged in, block and redirect to /login
  if (!user) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = "/login";
    return NextResponse.redirect(targetUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets (images, qrcodes, svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|images/|qrcodes/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

