"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";

export type AuthFormState = {
  status: "idle" | "error" | "sent";
  message?: "invalid" | "credentials" | "rateLimited" | "unconfirmed";
};

/** Only same-site staff paths are allowed as a post-login destination. */
export async function safeNext(next: unknown): Promise<string> {
  return typeof next === "string" && /^\/(app|admin)(\/[\w\-/]*)?$/.test(next) ? next : "/app";
}

const passwordSchema = z.object({
  email: z.email(),
  password: z.string().min(6).max(200),
  next: z.string().optional(),
});

export async function signInWithPassword(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "invalid" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    if (error.status === 429) return { status: "error", message: "rateLimited" };
    // Signed up but never clicked the confirmation email: say so instead of "wrong password".
    if (error.code === "email_not_confirmed") return { status: "error", message: "unconfirmed" };
    return { status: "error", message: "credentials" };
  }
  redirect(await safeNext(parsed.data.next));
}

const linkSchema = z.object({ email: z.email(), next: z.string().optional(), locale: z.enum(["es", "en"]) });

export async function sendMagicLink(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const parsed = linkSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { status: "error", message: "invalid" };
  const origin =
    (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const next = await safeNext(parsed.data.next);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  // Same answer whether or not the address has an account, so the form can't be used to probe emails.
  if (error && error.status === 429) return { status: "error", message: "rateLimited" };
  return { status: "sent" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/es/entrar");
}
