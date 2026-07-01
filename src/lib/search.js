// ─────────────────────────────────────────────────────────────────────────────
// search.js — global search for the ⌘K palette. Prefers the server-side
// global_search() RPC; degrades gracefully to a client-side scan of already-
// loaded state when offline or when the RPC isn't deployed yet (PGRST202).
//
// Result rows are uniform: { type, id, label, sublabel }. Routing is derived
// from `type` on the client (see ROUTE_FOR) so it stays precise even when the
// RPC's coarse `route` hint differs.
// ─────────────────────────────────────────────────────────────────────────────

import { globalSearchRpc } from "./db";

// type → RouterContext target. `param` names the id param the target page wants.
export const ROUTE_FOR = {
  container: { page: "container-log", param: "containerId" },
  voyage: { page: "voyage-detail", param: "voyageId" },
  shipper: { page: "masters" },
  consignee: { page: "masters" },
  booking: { page: "manifest" },
  expense: { page: "expenses", param: "focusId" },
};

const match = (hay, q) => (hay || "").toLowerCase().includes(q);

// Client-side scan over loaded app state — the offline / no-RPC fallback.
function localSearch(q, data = {}) {
  const needle = q.toLowerCase();
  const out = [];
  const { voyages = [], shippers = [], consignees = [], expenses = [] } = data;

  for (const v of voyages) {
    if (
      match(v.vessel, needle) ||
      match(v.voyageNo, needle) ||
      match(v.bookingRef, needle) ||
      match(v.blNo, needle)
    )
      out.push({ type: "voyage", id: v.id, label: v.vessel || v.voyageNo, sublabel: v.voyageNo || "" });
    for (const c of v.containers || []) {
      if (match(c.number, needle) || match(c.sealNo, needle) || match(c.sealNo2, needle))
        out.push({
          type: "container",
          id: c.id,
          label: c.number || c.sealNo,
          sublabel: v.vessel || "",
        });
    }
  }
  for (const s of shippers)
    if (match(s.name, needle))
      out.push({ type: "shipper", id: s.id, label: s.name, sublabel: s.address || "" });
  for (const c of consignees)
    if (match(c.name, needle))
      out.push({ type: "consignee", id: c.id, label: c.name, sublabel: c.address || "" });
  for (const e of expenses)
    if (match(e.description, needle) || match(e.category, needle) || match(e.referenceNo, needle))
      out.push({
        type: "expense",
        id: e.id,
        label: e.description || e.category,
        sublabel: e.category || "",
      });

  return out.slice(0, 40);
}

// Returns { rows, offline } — `offline` true when the client-side path was used.
export async function globalSearch(q, fallbackData) {
  const query = (q || "").trim();
  if (!query) return { rows: [], offline: false };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { rows: localSearch(query, fallbackData), offline: true };
  }

  try {
    const { data, error } = await globalSearchRpc(query);
    if (error) return { rows: localSearch(query, fallbackData), offline: true };
    return { rows: data || [], offline: false };
  } catch {
    return { rows: localSearch(query, fallbackData), offline: true };
  }
}
