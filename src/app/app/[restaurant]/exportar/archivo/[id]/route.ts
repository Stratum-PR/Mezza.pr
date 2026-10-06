import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";

/** Downloads a stored export again through a short-lived signed URL (RLS checks the role). */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/app/[restaurant]/exportar/archivo/[id]">,
) {
  const { restaurant: slug, id } = await params;
  const ctx = await requireSection(slug, "export");
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const db = await createClient();
  const { data: row } = await db
    .from("exports")
    .select("file_path")
    .eq("restaurant_id", ctx.restaurant.id)
    .eq("id", id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const name = row.file_path.split("/").pop();
  const { data } = await db.storage.from("exports").createSignedUrl(row.file_path, 60, { download: name });
  if (!data?.signedUrl) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
