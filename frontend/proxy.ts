import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Auth gate in Next.js 16 (proxy.ts). Refreshes the Supabase session
 * cookie on every navigation and redirects signed-out users to /sign-in.
 *
 * Landing page (/) and auth pages (/sign-in, /sign-up) remain publicly accessible.
 */
export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const path = request.nextUrl.pathname;
    const isPublicPage = path === "/" || path === "/sign-in" || path === "/sign-up";

    if (!user && !isPublicPage) {
      return NextResponse.redirect(new URL("/sign-in", request.url));
    }
    if (user && (path === "/sign-in" || path === "/sign-up")) {
      return NextResponse.redirect(new URL("/library", request.url));
    }
  } catch {
    // If Supabase auth throws invalid key error, allow public navigation
  }
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
