import "server-only";
import { getMessages } from "next-intl/server";
import type { MenuLocale } from "./types";

/** Both languages' menu strings, so the guest phone can switch ES/EN on its own. */
export async function menuMessages(): Promise<Record<MenuLocale, Record<string, unknown>>> {
  const [es, en] = await Promise.all([getMessages({ locale: "es" }), getMessages({ locale: "en" })]);
  return { es: es.menu as Record<string, unknown>, en: en.menu as Record<string, unknown> };
}
