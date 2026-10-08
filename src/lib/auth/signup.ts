"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { rateLimiter } from "@/connectors/rate-limit";
import { clientIp } from "@/lib/client-ip";
import { createAdminClient } from "@/lib/db/admin";
import { createClient } from "@/lib/db/server";
import { publicEnv } from "@/lib/env";
import { slugify, uniqueSlug } from "@/lib/slug";

export type SignupState = {
  status: "idle" | "error" | "confirm_email";
  error?: "invalid" | "email_taken" | "weak_password" | "rate_limited" | "failed";
  fields?: string[];
};

const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: z.email().max(200),
  password: z.string().min(8).max(200),
  restaurantName: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[\d\s()+-]+$/),
  terms: z.literal("on"),
  locale: z.enum(["es", "en"]),
});

/** Links in emails point at the site itself, never at the request's Origin header. */
const origin = () => publicEnv.NEXT_PUBLIC_SITE_URL;

/**
 * Onboarding step 1: creates the user, then the restaurant with its owner membership, default QR
 * design and 30-day trial (create_restaurant_with_owner). No card.
 */
export async function signUp(_: SignupState, form: FormData): Promise<SignupState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      status: "error",
      error: "invalid",
      fields: [...new Set(parsed.error.issues.map((i) => String(i.path[0])))],
    };
  }
  const d = parsed.data;
  const ip = await clientIp();
  if (!(await rateLimiter().limit(`signup:${ip}`, 10, 3600)).ok)
    return { status: "error", error: "rate_limited" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: d.email,
    password: d.password,
    options: {
      data: { full_name: d.fullName },
      emailRedirectTo: `${origin()}/api/auth/callback?next=/app`,
    },
  });
  if (error) {
    if (error.code === "user_already_exists" || /already registered/i.test(error.message)) {
      return { status: "error", error: "email_taken" };
    }
    if (error.code === "weak_password") return { status: "error", error: "weak_password" };
    return { status: "error", error: "failed" };
  }
  const userId = data.user?.id;
  // With email confirmation on, Supabase returns a user with no identities for an existing address.
  if (!userId || data.user?.identities?.length === 0) return { status: "error", error: "email_taken" };

  const admin = createAdminClient();
  const slug = await uniqueSlug(slugify(d.restaurantName), async (s) => {
    const { count } = await admin
      .from("restaurants")
      .select("id", { count: "exact", head: true })
      .eq("slug", s);
    return (count ?? 0) > 0;
  });
  const created = await admin.rpc("create_restaurant_with_owner", {
    p_owner_id: userId,
    p_name: d.restaurantName,
    p_slug: slug,
    p_phone: d.phone,
    p_language: d.locale,
  });
  if (created.error) return { status: "error", error: "failed" };
  await admin.from("profiles").update({ full_name: d.fullName }).eq("user_id", userId);

  if (!data.session) return { status: "confirm_email" };
  redirect(`/app/${slug}/empezar`);
}

const resetSchema = z.object({ email: z.email().max(200) });

export type ResetState = { status: "idle" | "sent" | "error" };

/** Always answers "sent" so the form can't reveal which addresses have accounts. */
export async function requestPasswordReset(_: ResetState, form: FormData): Promise<ResetState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error" };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin()}/api/auth/callback?next=/app/contrasena`,
  });
  return { status: "sent" };
}

const newPasswordSchema = z
  .object({ password: z.string().min(8).max(200), confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"] });

export type NewPasswordState = { status: "idle" | "error"; error?: "mismatch" | "weak" | "failed" };

export async function setNewPassword(_: NewPasswordState, form: FormData): Promise<NewPasswordState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues.some((i) => i.path[0] === "confirm") ? "mismatch" : "weak",
    };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", error: error.code === "weak_password" ? "weak" : "failed" };
  redirect("/app");
}
