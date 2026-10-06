import { cookies } from "next/headers";
import { locale as rootLocale } from "next/root-params";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./locales";

/** The [locale] root param on marketing pages; undefined elsewhere (and in actions/route handlers, where it throws). */
async function segmentLocale(): Promise<string | undefined> {
  try {
    return await rootLocale();
  } catch {
    return undefined;
  }
}

export async function resolveLocale(explicit?: string): Promise<Locale> {
  if (isLocale(explicit)) return explicit;
  const fromSegment = await segmentLocale();
  if (isLocale(fromSegment)) return fromSegment;
  // TODO(phase 3): prefer profiles.preferred_language for signed-in staff.
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(fromCookie) ? fromCookie : DEFAULT_LOCALE;
}

export default getRequestConfig(async ({ locale }) => {
  const resolved = await resolveLocale(locale);
  return {
    locale: resolved,
    timeZone: "America/Puerto_Rico",
    messages: (await import(`../../messages/${resolved}.json`)).default,
  };
});
