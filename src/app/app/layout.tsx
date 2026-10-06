import type { Metadata } from "next";
import { Document } from "@/components/shell/document";
import { resolveLocale } from "@/i18n/request";
import "../globals.css";

export const metadata: Metadata = {
  title: { default: "Mezza", template: "%s · Mezza" },
  robots: { index: false, follow: false },
};

/** Staff and owner app root layout (/app): no locale prefix, no texture. */
export default async function AppRootLayout({ children }: LayoutProps<"/app">) {
  return <Document locale={await resolveLocale()}>{children}</Document>;
}
