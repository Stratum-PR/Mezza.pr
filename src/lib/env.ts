import { z } from "zod";

/** Public variables (safe in the browser bundle). Next inlines NEXT_PUBLIC_* at build time. */
export const publicEnv = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
    NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_GUEST_BASE_URL: z.url().default("http://localhost:3000"),
    NEXT_PUBLIC_GUEST_DISPLAY_HOST: z.string().default("mezza.pr"),
  })
  .parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_GUEST_BASE_URL: process.env.NEXT_PUBLIC_GUEST_BASE_URL,
    NEXT_PUBLIC_GUEST_DISPLAY_HOST: process.env.NEXT_PUBLIC_GUEST_DISPLAY_HOST,
  });
