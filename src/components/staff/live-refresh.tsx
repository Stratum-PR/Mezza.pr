"use client";

import { useLiveRefresh } from "./live";

/** Drop-in live refresh for server-rendered staff pages that have no other client state. */
export function LiveRefresh({ slug, impl }: { slug: string; impl: "polling" | "supabase_stub" }) {
  useLiveRefresh(slug, "server", impl);
  return null;
}
