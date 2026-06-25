import { supabase } from "./supabase";

// Single Kraft org for now (seeded in SPEC.md schema).
export const KRAFT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// ── Mappers: Supabase rows (snake_case) ↔ app domain (camelCase) ──────────────
// The UI works with a nested camelCase shape (voyage → containers → lines).
// Supabase stores flat, snake_case relational rows. Keep the translation here so
// the rest of the app never sees DB column names.

export const fromDbVoyage = (r) => ({
  id: r.id,
  orgId: r.org_id,
  vessel: r.vessel,
  voyageNo: r.voyage_no,
  date: r.date,
  pol: r.pol,
  pod: r.pod,
  etd: r.etd,
  shippingLine: r.shipping_line,
  imoNo: r.imo_no,
  bookingRef: r.booking_ref,
  blNo: r.bl_no,
  chaName: r.cha_name,
  chaContact: r.cha_contact,
  containers: [],
});

export const toDbVoyage = (v) => ({
  id: v.id,
  org_id: v.orgId ?? KRAFT_ORG_ID,
  created_by: v.createdBy ?? null,
  vessel: v.vessel ?? null,
  voyage_no: v.voyageNo ?? null,
  date: v.date ?? null,
  pol: v.pol ?? undefined,
  pod: v.pod ?? undefined,
  etd: v.etd ?? null,
  shipping_line: v.shippingLine ?? null,
  imo_no: v.imoNo ?? null,
  booking_ref: v.bookingRef ?? null,
  bl_no: v.blNo ?? null,
  cha_name: v.chaName ?? null,
  cha_contact: v.chaContact ?? null,
});

export const fromDbContainer = (r) => ({
  id: r.id,
  voyageId: r.voyage_id,
  number: r.number || "",
  size: r.size || "20",
  capacityBags: r.capacity_bags ?? 340,
  capacityUnit: r.capacity_unit || "Bags",
  sealNo: r.seal_no || "",
  sealNo2: r.seal_no_2 || "",
  sealed: !!r.sealed,
  sealedAt: r.sealed_at,
  tareWeightKg: r.tare_weight_kg ?? 2200,
  cmlKg: r.cml_kg ?? 28000,
  condition: r.condition || "Clean",
  sortOrder: r.sort_order ?? 0,
  lines: [],
});

export const toDbContainer = (c) => ({
  id: c.id,
  voyage_id: c.voyageId,
  number: c.number ?? null,
  size: c.size ?? undefined,
  capacity_bags: c.capacityBags ?? undefined,
  capacity_unit: c.capacityUnit ?? undefined,
  seal_no: c.sealNo ?? null,
  seal_no_2: c.sealNo2 ?? null,
  sealed: c.sealed ?? undefined,
  sealed_at: c.sealedAt ?? null,
  sealed_by: c.sealedBy ?? null,
  tare_weight_kg: c.tareWeightKg ?? undefined,
  cml_kg: c.cmlKg ?? undefined,
  condition: c.condition ?? undefined,
  sort_order: c.sortOrder ?? undefined,
});

export const fromDbLine = (r) => ({
  id: r.id,
  containerId: r.container_id,
  cargo: r.cargo,
  qty: Number(r.qty ?? 0),
  unit: r.unit || "Bags",
  unitWeightKg: Number(r.unit_weight_kg ?? 0),
  shipperId: r.shipper_id,
  shipper: r.shipper_name || "",
  consigneeId: r.consignee_id,
  consignee: r.consignee_name || "",
  notifyParty: r.notify_party || "",
  hsCode: r.hs_code || "",
  invoiceNos: r.invoice_nos || [],
  invoiceValue: r.invoice_value,
  invoiceCurrency: r.invoice_currency || "INR",
  ewayBillNo: r.eway_bill_no || "",
  chaRef: r.cha_ref || "",
  truckNo: r.truck_no || "",
  loggedBy: r.logged_by,
  loggedAt: r.logged_at,
});

export const toDbLine = (l) => ({
  id: l.id,
  container_id: l.containerId,
  cargo: l.cargo,
  qty: l.qty,
  unit: l.unit ?? undefined,
  unit_weight_kg: l.unitWeightKg ?? undefined,
  shipper_id: l.shipperId ?? null,
  shipper_name: l.shipper ?? null,
  consignee_id: l.consigneeId ?? null,
  consignee_name: l.consignee ?? null,
  notify_party: l.notifyParty ?? null,
  hs_code: l.hsCode ?? null,
  invoice_nos: l.invoiceNos ?? null,
  invoice_value: l.invoiceValue ?? null,
  invoice_currency: l.invoiceCurrency ?? undefined,
  eway_bill_no: l.ewayBillNo ?? null,
  cha_ref: l.chaRef ?? null,
  truck_no: l.truckNo ?? null,
  logged_by: l.loggedBy ?? null,
  sort_order: l.sortOrder ?? undefined,
});

// Partial-patch mappers: translate only the keys present in `patch` (camelCase)
// to DB columns, so updates never accidentally null untouched columns.
const mapKeys = (patch, keymap) => {
  const out = {};
  for (const k in patch) if (k in keymap) out[keymap[k]] = patch[k];
  return out;
};

const CONTAINER_KEYMAP = {
  number: "number",
  size: "size",
  capacityBags: "capacity_bags",
  capacityUnit: "capacity_unit",
  sealNo: "seal_no",
  sealNo2: "seal_no_2",
  sealed: "sealed",
  sealedAt: "sealed_at",
  sealedBy: "sealed_by",
  tareWeightKg: "tare_weight_kg",
  cmlKg: "cml_kg",
  condition: "condition",
  sortOrder: "sort_order",
};

const VOYAGE_KEYMAP = {
  vessel: "vessel",
  voyageNo: "voyage_no",
  date: "date",
  pol: "pol",
  pod: "pod",
  etd: "etd",
  shippingLine: "shipping_line",
  imoNo: "imo_no",
  bookingRef: "booking_ref",
  blNo: "bl_no",
  chaName: "cha_name",
  chaContact: "cha_contact",
};

export const toDbContainerPatch = (patch) => mapKeys(patch, CONTAINER_KEYMAP);
export const toDbVoyagePatch = (patch) => mapKeys(patch, VOYAGE_KEYMAP);

export const fromDbShipper = (r) => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  address: r.address || "",
  gstin: r.gstin || "",
  iecCode: r.iec_code || "",
});

export const toDbShipper = (s) => ({
  id: s.id ?? undefined,
  org_id: s.orgId ?? KRAFT_ORG_ID,
  name: s.name,
  address: s.address ?? null,
  gstin: s.gstin ?? null,
  iec_code: s.iecCode ?? null,
});

export const fromDbConsignee = (r) => ({
  id: r.id,
  orgId: r.org_id,
  name: r.name,
  address: r.address || "",
  country: r.country || "IN",
});

export const toDbConsignee = (c) => ({
  id: c.id ?? undefined,
  org_id: c.orgId ?? KRAFT_ORG_ID,
  name: c.name,
  address: c.address ?? null,
  country: c.country ?? undefined,
});

// Strip `undefined` keys so we never overwrite columns with NULL on partial
// updates / inserts (lets Postgres column defaults apply).
const clean = (obj) => {
  const out = {};
  for (const k in obj) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
};

// ── Offline queue ─────────────────────────────────────────────────────────────
const QUEUE_KEY = "kraft-sync-queue-v1";

const readQueue = () => {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    return [];
  }
};

const writeQueue = (q) => {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    // storage full / unavailable — nothing we can do
  }
};

export const pendingCount = () => readQueue().length;

const enqueue = (op) => {
  const q = readQueue();
  q.push({ ...op, ts: Date.now() });
  writeQueue(q);
};

// A failure is "offline-ish" if the browser is offline or the error looks like a
// dropped/blocked network request rather than a real DB/validation error.
const isNetworkError = (error) => {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (!error) return false;
  if (error.name === "TypeError") return true; // fetch() throws TypeError on network fail
  const msg = (error.message || "").toLowerCase();
  return (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("load failed")
  );
};

// Raw executors — the actual Supabase calls. Used both for live writes and when
// replaying queued ops on reconnect.
const executors = {
  createVoyage: (p) => supabase.from("voyages").insert(p).select().single(),
  updateVoyage: ({ id, patch }) =>
    supabase.from("voyages").update(patch).eq("id", id).select().single(),
  createContainer: (p) => supabase.from("containers").insert(p).select().single(),
  updateContainer: ({ id, patch }) =>
    supabase.from("containers").update(patch).eq("id", id).select().single(),
  createLine: (p) => supabase.from("stuffing_lines").insert(p).select().single(),
  deleteLine: ({ id }) => supabase.from("stuffing_lines").delete().eq("id", id),
  upsertShipper: (p) =>
    supabase.from("shippers").upsert(p).select().single(),
  upsertConsignee: (p) =>
    supabase.from("consignees").upsert(p).select().single(),
};

// Run a write, queueing it for later if we are offline. Returns {data, error}.
// `optimistic` is what we hand back as `data` when the write was queued so the
// caller (reducer) already has the row it needs for instant UI.
async function runWrite(kind, payload, optimistic) {
  try {
    const { data, error } = await executors[kind](payload);
    if (error) {
      if (isNetworkError(error)) {
        enqueue({ kind, payload });
        return { data: optimistic ?? null, error: null, queued: true };
      }
      return { data: null, error };
    }
    return { data: data ?? optimistic ?? null, error: null };
  } catch (error) {
    if (isNetworkError(error)) {
      enqueue({ kind, payload });
      return { data: optimistic ?? null, error: null, queued: true };
    }
    return { data: null, error };
  }
}

// Replay every queued op against Supabase. Stops keeping ops that still fail on
// network; drops ops that fail for other reasons (already applied, etc.).
export async function flushQueue() {
  const q = readQueue();
  if (q.length === 0) return { flushed: 0, remaining: 0 };

  const remaining = [];
  let flushed = 0;
  for (const op of q) {
    try {
      const { error } = await executors[op.kind](op.payload);
      if (error && isNetworkError(error)) remaining.push(op);
      else flushed++;
    } catch (error) {
      if (isNetworkError(error)) remaining.push(op);
      else flushed++; // non-network failure — don't loop forever on it
    }
  }
  writeQueue(remaining);
  return { flushed, remaining: remaining.length };
}

// ── Profiles ──────────────────────────────────────────────────────────────────
// Ensure an authenticated user has a profile row (idempotent upsert).
export async function ensureProfile(user) {
  if (!user) return { data: null, error: new Error("no user") };
  const { data: existing, error: selErr } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  if (selErr) return { data: null, error: selErr };
  if (existing) return { data: existing, error: null };

  const profile = {
    id: user.id,
    org_id: KRAFT_ORG_ID,
    display_name: user.email || "",
    role: "staff",
  };
  const { data, error } = await supabase
    .from("profiles")
    .upsert(profile, { onConflict: "id", ignoreDuplicates: false })
    .select()
    .single();
  return { data, error };
}

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function fetchVoyages(orgId) {
  const { data, error } = await supabase
    .from("voyages")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  return { data, error };
}

export async function fetchContainers(voyageId) {
  const { data, error } = await supabase
    .from("containers")
    .select("*")
    .eq("voyage_id", voyageId)
    .order("sort_order", { ascending: true });
  return { data, error };
}

export async function fetchLines(containerId) {
  const { data, error } = await supabase
    .from("stuffing_lines")
    .select("*")
    .eq("container_id", containerId)
    .order("sort_order", { ascending: true });
  return { data, error };
}

export async function fetchShippers(orgId) {
  const { data, error } = await supabase
    .from("shippers")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  return { data, error };
}

export async function fetchConsignees(orgId) {
  const { data, error } = await supabase
    .from("consignees")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });
  return { data, error };
}

// ── Writes (offline-aware) ────────────────────────────────────────────────────
// `voyage`, `container`, `line` args are DB-shaped rows (use the toDb* mappers).
export function createVoyage(voyage) {
  const p = clean(voyage);
  return runWrite("createVoyage", p, p);
}

export function updateVoyage(id, patch) {
  const p = clean(patch);
  return runWrite("updateVoyage", { id, patch: p }, { id, ...p });
}

export function createContainer(container) {
  const p = clean(container);
  return runWrite("createContainer", p, p);
}

export function updateContainer(id, patch) {
  const p = clean(patch);
  return runWrite("updateContainer", { id, patch: p }, { id, ...p });
}

export function createLine(line) {
  const p = clean(line);
  return runWrite("createLine", p, p);
}

export function deleteLine(id) {
  return runWrite("deleteLine", { id }, { id });
}

export function upsertShipper(shipper) {
  const p = clean(shipper);
  return runWrite("upsertShipper", p, p);
}

export function upsertConsignee(consignee) {
  const p = clean(consignee);
  return runWrite("upsertConsignee", p, p);
}
