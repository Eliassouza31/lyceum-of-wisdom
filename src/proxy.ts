import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import {
  DEFAULT_AFTER_LOGIN,
  isGuestOnlyPath,
  isProtectedPath,
} from "@/lib/auth/redirects";
import { readSupabaseConfig } from "@/lib/supabase/config";

/**
 * Runs before every page request: refreshes the Supabase session cookie and
 * redirects between public and protected areas. Pages still verify the user
 * themselves; this is the first line of defense, not the only one.
 */
export async function proxy(request: NextRequest) {
  const config = readSupabaseConfig();
  if (!config) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // getClaims() validates the JWT; never trust an unverified session in the proxy.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isSignedIn && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return redirectWithCookies(url, response);
  }

  if (isSignedIn && isGuestOnlyPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_AFTER_LOGIN;
    url.search = "";
    return redirectWithCookies(url, response);
  }

  return response;
}

function redirectWithCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  const cacheControl = from.headers.get("Cache-Control");
  if (cacheControl) redirect.headers.set("Cache-Control", cacheControl);
  return redirect;
}

export const config = {
  matcher: [
    // Everything except API routes, Next.js internals and static files.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
