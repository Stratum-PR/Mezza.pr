import type { Metadata, Viewport } from "next";
import { Document } from "@/components/shell/document";
import { resolveLocale } from "@/i18n/request";
import "../globals.css";

export const metadata: Metadata = {
  title: "Mezza",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1E2B7E",
};

/** Guest root layout (/r): phone-first, no Supabase client in this bundle. */
export default async function GuestRootLayout({ children }: LayoutProps<"/r">) {
  return <Document locale={await resolveLocale()}>{children}</Document>;
}
