import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { menuImageSize } from "./image";

export async function readOriginalUpload(
  db: SupabaseClient<Database>,
  restaurantId: string,
  uploadId: string,
) {
  const { data: upload, error } = await db
    .from("menu_uploads")
    .select("id, storage_path, mime_type, status")
    .eq("restaurant_id", restaurantId)
    .eq("id", uploadId)
    .maybeSingle();
  if (error) throw new Error("menu upload query failed");
  if (!upload) return null;
  if (!upload.storage_path.startsWith(`${restaurantId}/uploads/`)) throw new Error("invalid upload path");
  const { data: file, error: downloadError } = await db.storage.from("menus").download(upload.storage_path);
  if (downloadError || !file) throw new Error("original menu image download failed");
  const size = await menuImageSize(Buffer.from(await file.arrayBuffer()), upload.mime_type);
  return { ...upload, ...size };
}
