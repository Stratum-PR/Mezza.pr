import "server-only";
import { headers } from "next/headers";

/**
 * The client's IP for rate limits, from headers the hosting platform sets and overwrites (Vercel:
 * `x-vercel-forwarded-for`, `x-real-ip`). Raw `x-forwarded-for` is not used: a client can send its
 * own. Without a trusted header (local dev) every request shares "local", so per-IP limits are the
 * weakest layer; per-phone and per-table limits matter more.
 */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "local";
}
