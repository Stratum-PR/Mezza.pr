import "server-only";
import { createAdminClient } from "@/lib/db/admin";
import type { Json } from "@/lib/db/types";
import { CAFE_LUCIA_PRINTED } from "@/components/menu/fixtures/cafe-lucia";
import { cafeLuciaImportResult } from "./fixture-result";
import type { MenuImporter, MenuImportResult } from "./types";

const PROCESSING_MS = 2500;

/** Dev importer: "reads" any upload and, after a short delay, returns Café Lucía's menu. */
export const fixtureImporter: MenuImporter = {
  async start(ctx, upload) {
    const { data, error } = await createAdminClient()
      .from("menu_uploads")
      .insert({
        restaurant_id: ctx.restaurantId,
        storage_path: upload.storagePath,
        mime_type: upload.mimeType,
        status: "processing",
      })
      .select("id")
      .single();
    if (error) throw new Error(`upload record failed: ${error.message}`);
    return { uploadId: data.id };
  },

  async result(ctx, uploadId) {
    const db = createAdminClient();
    const { data: upload, error } = await db
      .from("menu_uploads")
      .select("status, created_at, storage_path, ai_result")
      .eq("id", uploadId)
      .eq("restaurant_id", ctx.restaurantId)
      .maybeSingle();
    if (error || !upload) return { status: "failed", error: "upload_not_found" };
    if (upload.status === "failed") return { status: "failed", error: "import_failed" };
    if (upload.status === "processing" && Date.now() - Date.parse(upload.created_at) < PROCESSING_MS) {
      return { status: "processing" };
    }
    if (upload.status === "processing") {
      // The fixture "detects" Café Lucía's printed page and stores it for the review screen.
      const pagePath = `${ctx.restaurantId}/imports/${uploadId}/page-1.svg`;
      const stored = await db.storage
        .from("menus")
        .upload(pagePath, new Blob([CAFE_LUCIA_PRINTED.svg], { type: "image/svg+xml" }), {
          contentType: "image/svg+xml",
          upsert: true,
        });
      if (stored.error) return { status: "failed", error: "page_store_failed" };
      const result = cafeLuciaImportResult(pagePath);
      await db
        .from("menu_uploads")
        .update({ status: "review", ai_result: result as unknown as Json })
        .eq("id", uploadId);
      return { status: "review", result };
    }
    return { status: "review", result: upload.ai_result as unknown as MenuImportResult };
  },
};
