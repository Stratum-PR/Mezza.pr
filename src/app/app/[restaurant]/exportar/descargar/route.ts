import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { requireSection } from "@/lib/auth/staff";
import { EXPORT_KINDS, runExport } from "@/lib/exports/run";

const querySchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});

/** Builds an export, keeps a copy in exports, and downloads it. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/app/[restaurant]/exportar/descargar">,
) {
  const { restaurant: slug } = await params;
  const ctx = await requireSection(slug, "export");
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const locale = (await getLocale()) === "en" ? "en" : "es";

  const file = await runExport(ctx, parsed.data.kind, parsed.data.month, locale);
  return new NextResponse(file.body as BodyInit, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
