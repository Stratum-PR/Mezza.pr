import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, LOCALE_COOKIE, LOCALES } from "./locales";

// Locale prefixes apply to the marketing site only (/es, /en).
// /app, /r and /admin have no prefix and read the locale from the profile or the cookie.
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
  localeCookie: { name: LOCALE_COOKIE, sameSite: "lax" },
});
