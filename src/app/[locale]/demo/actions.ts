"use server";

import { z } from "zod";
import { notifier } from "@/connectors/notifier";
import { rateLimiter } from "@/connectors/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/db/admin";

export type DemoRequestState = {
  status: "idle" | "sent" | "error";
  error?: "invalid" | "rate_limited" | "failed";
  fields?: string[];
};

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  restaurantName: z.string().trim().max(120).optional().default(""),
  email: z.email().max(200),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[\d\s()+-]*$/)
    .optional()
    .default(""),
  message: z.string().trim().max(2000).optional().default(""),
  locale: z.enum(["es", "en"]),
  website: z.string().max(0).optional(), // honeypot: people never fill it
});

export async function requestDemo(_: DemoRequestState, form: FormData): Promise<DemoRequestState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    if (parsed.error.issues.some((i) => i.path[0] === "website")) return { status: "sent" }; // quietly drop bots
    return {
      status: "error",
      error: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const ip = await clientIp();
  const allowed = await rateLimiter().limit(`demo-request:${ip}`, 5, 3600);
  if (!allowed.ok) return { status: "error", error: "rate_limited" };

  const d = parsed.data;
  const { error } = await createAdminClient()
    .from("demo_requests")
    .insert({
      name: d.name,
      restaurant_name: d.restaurantName || null,
      email: d.email,
      phone: d.phone || null,
      message: d.message || null,
      locale: d.locale,
    });
  if (error) return { status: "error", error: "failed" };

  await notifier().email(
    process.env.STRATUM_LEADS_EMAIL ?? "contact@stratumpr.com",
    "demo_request",
    d.locale,
    {
      name: d.name,
      restaurantName: d.restaurantName,
      email: d.email,
      phone: d.phone,
      message: d.message,
    },
  );
  return { status: "sent" };
}
