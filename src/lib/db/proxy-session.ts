import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/locales";

/** /app and /admin need a signed-in user; guest pages (/r) and /api handle their own access. */
const PROTECTED = /^\/(app|admin)(\/|$)/;

/**
 * Refreshes the Supabase session cookie on every staff request and sends signed-out users to the
 * login page in their language. Authorization (membership, role, platform admin) happens in the
 * layouts and server actions, not here.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet, headers) => {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [h, v] of Object.entries(headers)) response.headers.set(h, v);
      },
    },
  });

  // getClaims validates the JWT; don't trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && PROTECTED.test(request.nextUrl.pathname)) {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    const locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;
    const login = new URL(`/${locale}/entrar`, request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return response;
}
