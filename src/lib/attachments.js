import { supabase } from "./supabase";
import { KRAFT_ORG_ID } from "./db";

const BUCKET = "attachments";

// ── Mapper ──────────────────────────────────────────────────────────────────
export const fromDbAttachment = (r) => ({
  id: r.id,
  orgId: r.org_id,
  parentType: r.parent_type,
  parentId: r.parent_id,
  fileName: r.file_name,
  mimeType: r.mime_type,
  sizeBytes: r.size_bytes,
  storagePath: r.storage_path,
  source: r.source,
  voidedAt: r.voided_at,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

// ── Reads ─────────────────────────────────────────────────────────────────
// Non-voided by default — void is a soft delete, so voided rows stay in the
// table for audit but drop out of the panel unless explicitly requested.
export async function fetchAttachments({ parentType, parentId, includeVoided = false } = {}) {
  let q = supabase
    .from("attachments")
    .select("*")
    .eq("parent_type", parentType)
    .eq("parent_id", parentId)
    .order("created_at", { ascending: false });
  if (!includeVoided) q = q.is("voided_at", null);
  const { data, error } = await q;
  return { data: (data || []).map(fromDbAttachment), error };
}

// ── Writes ────────────────────────────────────────────────────────────────
const safeName = (name) => (name || "file").replace(/[^\w.\-]+/g, "_").slice(-80);

// Uploads the binary to Storage, then inserts one metadata row. Binary uploads
// are online-only (never queued through the offline write path) — callers gate
// the affordance on connectivity. Returns { data, error }; on a metadata-insert
// failure the uploaded object is best-effort removed so we don't orphan it.
export async function uploadAttachment({ parentType, parentId, blob, fileName, mimeType, source = "upload", createdBy }) {
  const path = `${parentType}/${parentId}/${Date.now()}-${safeName(fileName)}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: mimeType, upsert: false });
  if (uploadError) return { data: null, error: uploadError };

  const { data, error } = await supabase
    .from("attachments")
    .insert({
      org_id: KRAFT_ORG_ID,
      parent_type: parentType,
      parent_id: parentId,
      file_name: fileName,
      mime_type: mimeType,
      size_bytes: blob.size ?? 0,
      storage_path: path,
      source,
      created_by: createdBy ?? null,
    })
    .select()
    .single();

  if (error) {
    // Roll back the orphaned object — best effort, ignore its own failure.
    await supabase.storage.from(BUCKET).remove([path]).catch(() => {});
    return { data: null, error };
  }
  return { data: fromDbAttachment(data), error: null };
}

// Soft delete — never hard-delete; the Storage object is left in place.
export async function voidAttachment(id) {
  const { data, error } = await supabase
    .from("attachments")
    .update({ voided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbAttachment(data) : null, error };
}

export async function getSignedAttachmentUrl(storagePath, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, expiresIn);
  return { url: data?.signedUrl || null, error };
}
