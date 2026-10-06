import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";

export type Role = Database["public"]["Enums"]["member_role"];

export type AppSection =
  | "home"
  | "service"
  | "tables"
  | "kitchen"
  | "menu"
  | "qr"
  | "reports"
  | "export"
  | "team"
  | "settings"
  | "plan";

/** Which roles see which part of the app. Row-level security enforces the data side. */
export const SECTION_ROLES: Record<AppSection, Role[]> = {
  home: ["owner", "manager"],
  service: ["owner", "manager", "server"],
  tables: ["owner", "manager", "server"],
  kitchen: ["owner", "manager", "kitchen"],
  menu: ["owner", "manager"],
  qr: ["owner", "manager"],
  reports: ["owner", "manager"],
  export: ["owner", "manager"],
  team: ["owner", "manager"],
  settings: ["owner", "manager"],
  plan: ["owner"],
};

export const SECTION_PATH: Record<AppSection, string> = {
  home: "",
  service: "servicio",
  tables: "mesas",
  kitchen: "cocina",
  menu: "menu",
  qr: "qr",
  reports: "reportes",
  export: "exportar",
  team: "equipo",
  settings: "ajustes",
  plan: "plan",
};

export function canSee(role: Role, section: AppSection): boolean {
  return SECTION_ROLES[section].includes(role);
}

/** Where a role lands when it opens the app. */
export function homeFor(slug: string, role: Role): string {
  const section: AppSection = role === "server" ? "service" : role === "kitchen" ? "kitchen" : "home";
  const path = SECTION_PATH[section];
  return path ? `/app/${slug}/${path}` : `/app/${slug}`;
}

export const currentUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims.sub as string | undefined) ?? null;
});

export interface StaffContext {
  userId: string;
  role: Role;
  restaurant: Database["public"]["Tables"]["restaurants"]["Row"];
}

/**
 * The signed-in member of restaurant `slug`, or a redirect to login / 404. Cached per request so
 * layouts and pages share one lookup.
 */
export const requireStaff = cache(async (slug: string): Promise<StaffContext> => {
  const userId = await currentUserId();
  if (!userId) redirect(`/es/entrar?next=/app/${encodeURIComponent(slug)}`);
  const supabase = await createClient();
  const { data: restaurant } = await supabase.from("restaurants").select("*").eq("slug", slug).maybeSingle();
  if (!restaurant) notFound();
  const { data: membership } = await supabase
    .from("memberships")
    .select("role, active")
    .eq("restaurant_id", restaurant.id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership?.active) notFound();
  return { userId, role: membership.role, restaurant };
});

/** requireStaff plus a section check; members without access go to their own home screen. */
export async function requireSection(slug: string, section: AppSection): Promise<StaffContext> {
  const ctx = await requireStaff(slug);
  if (!canSee(ctx.role, section)) redirect(homeFor(slug, ctx.role));
  return ctx;
}

/** The restaurants the signed-in user belongs to. */
export async function myRestaurants() {
  const userId = await currentUserId();
  if (!userId) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, restaurants(slug, name)")
    .eq("user_id", userId)
    .eq("active", true);
  return (data ?? []).flatMap((m) => (m.restaurants ? [{ role: m.role, ...m.restaurants }] : []));
}

export async function requirePlatformAdmin(): Promise<string> {
  const userId = await currentUserId();
  if (!userId) redirect("/es/entrar?next=/admin");
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  if (!data) notFound();
  return userId;
}
