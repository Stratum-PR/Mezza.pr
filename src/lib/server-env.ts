import "server-only";
import { z } from "zod";

/** Server-only secrets. Importing this from a client component fails the build. */
export const serverEnv = z
  .object({
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
    QR_TOKEN_SECRET: z.string().min(32),
    CRON_SECRET: z.string().min(16),
    MEZZA_DEMO_MODE: z.enum(["true", "false"]).default("false"),
  })
  .parse(process.env);
