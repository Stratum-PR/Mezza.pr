import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { createClient } from "@/lib/db/server";
import { loadQrStudio } from "@/lib/qr/load";
import { renderQrPdf } from "@/lib/qr/pdf";

const querySchema = z.object({
  format: z.enum(["sheet", "tent", "sticker"]),
  tables: z.string().optional(), // comma-separated table ids; all tables when absent
});

/** Print-ready QR PDF for all or some tables. Each download is also stored in exports. */
export async function GET(request: NextRequest, { params }: RouteContext<"/app/[restaurant]/qr/pdf">) {
  const { restaurant: slug } = await params;
  const ctx = await requireSection(slug, "qr");
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });

  const db = await createClient();
  const studio = await loadQrStudio(db, ctx.restaurant);
  const wanted = parsed.data.tables?.split(",").filter(Boolean);
  const tables = wanted ? studio.tables.filter((t) => wanted.includes(t.id)) : studio.tables;
  if (tables.length === 0) return NextResponse.json({ error: "no_tables" }, { status: 400 });

  const pdf = await renderQrPdf(parsed.data.format, studio.design, tables);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `${ctx.restaurant.id}/qr/${parsed.data.format}-${stamp}.pdf`;
  const stored = await db.storage.from("exports").upload(path, pdf, { contentType: "application/pdf" });
  if (!stored.error) {
    await db.from("exports").insert({
      restaurant_id: ctx.restaurant.id,
      kind: "qr_pdf",
      period: parsed.data.format,
      file_path: path,
      created_by: ctx.userId,
    });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${slug}-qr-${parsed.data.format}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
