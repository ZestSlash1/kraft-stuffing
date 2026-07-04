import { supabase } from "./supabase";
import { KRAFT_ORG_ID } from "./db";

// ── Mappers: Supabase rows (snake_case) ↔ app domain (camelCase) ──────────────
export const fromDbCartingOrder = (r) => ({
  id: r.id,
  orgId: r.org_id,
  voyageId: r.voyage_id,
  bookingId: r.booking_id || null,
  orderDate: r.order_date,
  pol: r.pol || "",
  pod: r.pod || "",
  rotationNo: r.rotation_no || "",
  rotationDate: r.rotation_date || null,
  vcn: r.vcn || "",
  bookingNo: r.booking_no || "",
  tillText: r.till_text || "Till Finish",
  status: r.status || "draft",
  snapshot: r.snapshot || null,
  issuedAt: r.issued_at,
  issuedBy: r.issued_by,
  voidedAt: r.voided_at,
  pdfPath: r.pdf_path || "",
  createdBy: r.created_by,
  createdAt: r.created_at,
  containers: [],
});

export const toDbCartingOrder = (o) => ({
  id: o.id ?? undefined,
  org_id: o.orgId ?? KRAFT_ORG_ID,
  voyage_id: o.voyageId,
  booking_id: o.bookingId ?? null,
  order_date: o.orderDate ?? undefined,
  pol: o.pol ?? undefined,
  pod: o.pod ?? undefined,
  rotation_no: o.rotationNo ?? null,
  rotation_date: o.rotationDate ?? null,
  vcn: o.vcn ?? null,
  booking_no: o.bookingNo ?? null,
  till_text: o.tillText ?? undefined,
  created_by: o.createdBy ?? null,
});

const CARTING_ORDER_KEYMAP = {
  bookingId: "booking_id",
  orderDate: "order_date",
  pol: "pol",
  pod: "pod",
  rotationNo: "rotation_no",
  rotationDate: "rotation_date",
  vcn: "vcn",
  bookingNo: "booking_no",
  tillText: "till_text",
};
const mapKeys = (patch, keymap) => {
  const out = {};
  for (const k in patch) if (k in keymap) out[keymap[k]] = patch[k];
  return out;
};
export const toDbCartingOrderPatch = (patch) => mapKeys(patch, CARTING_ORDER_KEYMAP);

export const fromDbCartingContainer = (r) => ({
  id: r.id,
  cartingOrderId: r.carting_order_id,
  slNo: r.sl_no,
  containerNo: r.container_no || "",
  sizeType: r.size_type || "20",
  cargoGrWtKgs: Number(r.cargo_gr_wt_kgs ?? 0),
  tareWtKgs: Number(r.tare_wt_kgs ?? 0),
  vgmWtKgs: Number(r.vgm_wt_kgs ?? 0),
  cargoType: r.cargo_type || "",
  valuePaise: Number(r.value_paise ?? 0),
  packageLines: Array.isArray(r.package_lines) ? r.package_lines : [],
  createdAt: r.created_at,
});

export const toDbCartingContainer = (c) => ({
  id: c.id ?? undefined,
  carting_order_id: c.cartingOrderId,
  sl_no: c.slNo,
  container_no: c.containerNo ?? "",
  size_type: c.sizeType ?? "20",
  cargo_gr_wt_kgs: c.cargoGrWtKgs ?? 0,
  tare_wt_kgs: c.tareWtKgs ?? 0,
  vgm_wt_kgs: c.vgmWtKgs ?? 0,
  cargo_type: c.cargoType ?? "",
  value_paise: c.valuePaise ?? 0,
  package_lines: c.packageLines ?? [],
});

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function fetchCartingOrders(voyageId) {
  const { data, error } = await supabase
    .from("carting_orders")
    .select("*")
    .eq("voyage_id", voyageId)
    .order("created_at", { ascending: false });
  return { data: (data || []).map(fromDbCartingOrder), error };
}

export async function fetchCartingOrderContainers(cartingOrderId) {
  const { data, error } = await supabase
    .from("carting_order_containers")
    .select("*")
    .eq("carting_order_id", cartingOrderId)
    .order("sl_no", { ascending: true });
  return { data: (data || []).map(fromDbCartingContainer), error };
}

// Full order with its container lines attached.
export async function fetchCartingOrder(id) {
  const { data, error } = await supabase
    .from("carting_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) return { data: null, error };
  const order = fromDbCartingOrder(data);
  const { data: containers, error: cErr } = await fetchCartingOrderContainers(id);
  if (cErr) return { data: null, error: cErr };
  order.containers = containers;
  return { data: order, error: null };
}

// ── Writes ────────────────────────────────────────────────────────────────────
export async function createCartingOrder(draft) {
  const { data, error } = await supabase
    .from("carting_orders")
    .insert(toDbCartingOrder(draft))
    .select()
    .single();
  return { data: data ? fromDbCartingOrder(data) : null, error };
}

// Draft-only field patch. Issued orders are frozen — the UI blocks edits.
export async function updateCartingOrder(id, patch) {
  const { data, error } = await supabase
    .from("carting_orders")
    .update(toDbCartingOrderPatch(patch))
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbCartingOrder(data) : null, error };
}

export async function addCartingContainer(container) {
  const { data, error } = await supabase
    .from("carting_order_containers")
    .insert(toDbCartingContainer(container))
    .select()
    .single();
  return { data: data ? fromDbCartingContainer(data) : null, error };
}

export async function updateCartingContainer(id, container) {
  const { data, error } = await supabase
    .from("carting_order_containers")
    .update(toDbCartingContainer(container))
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbCartingContainer(data) : null, error };
}

// Hard delete is allowed ONLY while the parent order is still a draft (the row
// is not yet a lodged legal instrument). Callers must gate on status === 'draft'.
export async function deleteCartingContainer(id) {
  const { error } = await supabase.from("carting_order_containers").delete().eq("id", id);
  return { error };
}

// Assign the next CO number, upload the rendered PDF, and freeze `snapshot` —
// the point after which the order never changes except to be voided. Requires a
// live connection (race-safe numbering), mirroring issueDocument().
export async function issueCartingOrder(id, { snapshot, pdfBlob, issuedBy }) {
  const { data: number, error: numberError } = await supabase.rpc(
    "next_carting_order_number"
  );
  if (numberError) return { data: null, error: numberError };

  const pdfPath = `carting_order/${number.replace(/\//g, "_")}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: true });
  if (uploadError) return { data: null, error: uploadError };

  const { data, error } = await supabase
    .from("carting_orders")
    .update({
      status: "issued",
      snapshot: { ...snapshot, number },
      pdf_path: pdfPath,
      issued_at: new Date().toISOString(),
      issued_by: issuedBy ?? null,
    })
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbCartingOrder(data) : null, error };
}

// Never hard-delete an issued order — void it and, if needed, issue a fresh one.
export async function voidCartingOrder(id) {
  const { data, error } = await supabase
    .from("carting_orders")
    .update({ status: "void", voided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return { data: data ? fromDbCartingOrder(data) : null, error };
}
