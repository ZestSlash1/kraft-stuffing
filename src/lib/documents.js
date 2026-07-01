import { supabase } from "./supabase";
import { KRAFT_ORG_ID } from "./db";

// ── Mappers ───────────────────────────────────────────────────────────────
export const fromDbDocument = (r) => ({
  id: r.id,
  orgId: r.org_id,
  type: r.type,
  number: r.number || "",
  voyageId: r.voyage_id,
  containerId: r.container_id,
  bookingId: r.booking_id,
  payload: r.payload || null,
  status: r.status || "draft",
  issuedAt: r.issued_at,
  issuedBy: r.issued_by,
  pdfPath: r.pdf_path || "",
  createdAt: r.created_at,
});

export const toDbDocument = (d) => ({
  id: d.id ?? undefined,
  org_id: d.orgId ?? KRAFT_ORG_ID,
  type: d.type,
  voyage_id: d.voyageId ?? null,
  container_id: d.containerId ?? null,
  booking_id: d.bookingId ?? null,
});

// ── Reads ─────────────────────────────────────────────────────────────────
export async function fetchDocuments({ voyageId, containerId, type, status } = {}) {
  let q = supabase.from("documents").select("*").order("created_at", { ascending: false });
  if (voyageId) q = q.eq("voyage_id", voyageId);
  if (containerId) q = q.eq("container_id", containerId);
  if (type) q = q.eq("type", type);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  return { data: (data || []).map(fromDbDocument), error };
}

export async function fetchDocument(id) {
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).single();
  return { data: data ? fromDbDocument(data) : null, error };
}

// Latest issued document of a type for a container — used by AN/DO to find
// the HBL they reference.
export async function fetchLatestIssuedDocument({ containerId, type }) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("container_id", containerId)
    .eq("type", type)
    .eq("status", "issued")
    .order("issued_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return { data: data ? fromDbDocument(data) : null, error };
}

// ── Writes ────────────────────────────────────────────────────────────────
// Draft creation only — not offline-queued. Issuing a legal document needs a
// live connection to assign a race-safe number, so the UI should not offer
// "Generate" while offline.
export async function createDraftDocument({ type, voyageId, containerId, bookingId }) {
  const { data, error } = await supabase
    .from("documents")
    .insert(toDbDocument({ type, voyageId, containerId, bookingId }))
    .select()
    .single();
  return { data: data ? fromDbDocument(data) : null, error };
}

// Assigns the next document number, uploads the rendered PDF to Storage, and
// freezes `payload` — the one point after which this document never changes
// again except to be voided.
export async function issueDocument(id, { type, payload, pdfBlob, issuedBy }) {
  const { data: numberData, error: numberError } = await supabase.rpc("next_doc_number", {
    p_type: type,
  });
  if (numberError) return { data: null, error: numberError };
  const number = numberData;

  const pdfPath = `${type}/${number.replace(/\//g, "_")}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { data: null, error: uploadError };

  const { data, error } = await supabase
    .from("documents")
    .update({
      number,
      payload,
      pdf_path: pdfPath,
      status: "issued",
      issued_at: new Date().toISOString(),
      issued_by: issuedBy ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbDocument(data) : null, error };
}

// Never hard-delete a legal document — void and, if needed, issue a fresh one.
export async function voidDocument(id) {
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "void" })
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbDocument(data) : null, error };
}

export async function getSignedDocumentUrl(pdfPath, expiresIn = 300) {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(pdfPath, expiresIn);
  return { url: data?.signedUrl || null, error };
}
