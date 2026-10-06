import { cookies } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import type { Locale } from "@/i18n/locales";
import { fontVariables } from "@/lib/fonts";
import { cn } from "@/lib/cn";

/** Optional theme override; without it, dark mode follows prefers-color-scheme. */
export const THEME_COOKIE = "mezza-theme";

/** The saved theme choice for the switch: "light" | "dark", or "auto" (follow the device). */
export async function readThemeChoice(): Promise<"auto" | "light" | "dark"> {
  const v = (await cookies()).get(THEME_COOKIE)?.value;
  return v === "light" || v === "dark" ? v : "auto";
}

/** The <html>/<body> shell shared by every root layout (site, app, guest, admin). */
export async function Document({
  locale,
  bodyClassName,
  children,
}: {
  locale: Locale;
  bodyClassName?: string;
  children: ReactNode;
}) {
  const theme = (await cookies()).get(THEME_COOKIE)?.value;
  return (
    <html
      lang={locale}
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
      className={fontVariables}
      suppressHydrationWarning
    >
      <body className={cn("min-h-dvh", bodyClassName)}>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
