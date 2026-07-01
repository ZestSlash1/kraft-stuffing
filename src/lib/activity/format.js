// ─────────────────────────────────────────────────────────────────────────────
// activity/format.js — humanizer for audit_log rows. Maps a raw audit entry
// (snake_case, straight from supabase) plus a lookup context into one sentence,
// an icon name, a tone, and a RouterContext deep link.
//
// audit_log shape (see 0004_audit_log_triggers.sql):
//   { id, table_name, row_id, action /* INSERT|UPDATE|DELETE */,
//     changed_by, changed_at, old_data, new_data }
//
// The formatter is presentation-only: money reuses fmtPaise, names come from
// ctx.profilesById, container/vessel labels come from ctx lookups. It never
// re-implements a formatter and always degrades gracefully when a lookup misses.
// ─────────────────────────────────────────────────────────────────────────────

import {
  Lock,
  PackagePlus,
  Receipt,
  FileText,
  Ship,
  Navigation,
  Users,
  Pencil,
  Trash2,
  Activity,
} from "lucide-react";
import { fmtPaise } from "../../views/expenses/expenseHelpers";

// Section grouping for the "by section" filter and dot parity with the nav.
export const TABLE_SECTION = {
  voyages: "voyages",
  containers: "voyages",
  stuffing_lines: "voyages",
  bookings: "manifest",
  vessel_movements: "manifest",
  expenses: "expenses",
  shippers: "masters",
  consignees: "masters",
};

const SECTION_LABELS = {
  voyages: "Voyages",
  manifest: "Manifest",
  expenses: "Expenses",
  masters: "Masters",
};

export const SECTION_FILTERS = Object.entries(SECTION_LABELS).map(
  ([id, label]) => ({ id, label })
);

// Singularise a table_name for the fallback sentence.
const singular = (table) =>
  ({
    voyages: "voyage",
    containers: "container",
    stuffing_lines: "cargo line",
    bookings: "booking",
    vessel_movements: "vessel movement",
    expenses: "expense",
    shippers: "shipper",
    consignees: "consignee",
  })[table] || table.replace(/s$/, "");

const nameFor = (id, ctx) =>
  (id && ctx?.profilesById?.[id]) || "Someone";

// Resolve a container's display number: prefer the audit row, fall back to state.
const containerNo = (data, ctx) =>
  data?.number ||
  ctx?.containersById?.[data?.id]?.number ||
  ctx?.containersById?.[data?.container_id]?.number ||
  "container";

const vesselFor = (voyageId, ctx) =>
  ctx?.voyagesById?.[voyageId]?.vessel || "";

// Returns { id, text, Icon, tone, route, at } or null for entries we don't surface.
export function formatActivity(entry, ctx = {}) {
  if (!entry) return null;
  const table = entry.table_name;
  const op = entry.action;
  const data = entry.new_data || entry.old_data || {};
  const who = nameFor(entry.changed_by, ctx);
  const at = entry.changed_at;
  const base = { id: entry.id, at, tone: "neutral" };

  // containers — seals are the headline event.
  if (table === "containers") {
    if (op === "UPDATE" && data.sealed) {
      const vessel = vesselFor(data.voyage_id, ctx);
      return {
        ...base,
        Icon: Lock,
        tone: "green",
        text: `${who} sealed container ${containerNo(data, ctx)}${
          vessel ? ` on ${vessel}` : ""
        }`,
        route: { page: "container-log", params: { containerId: entry.row_id } },
      };
    }
    return {
      ...base,
      Icon: op === "INSERT" ? PackagePlus : Pencil,
      text: `${who} ${op === "INSERT" ? "added" : "updated"} container ${containerNo(
        data,
        ctx
      )}`,
      route: { page: "container-log", params: { containerId: entry.row_id } },
    };
  }

  // stuffing_lines — cargo added to a container.
  if (table === "stuffing_lines") {
    const cno = containerNo(data, ctx);
    return {
      ...base,
      Icon: op === "DELETE" ? Trash2 : PackagePlus,
      text:
        op === "DELETE"
          ? `${who} removed cargo from ${cno}`
          : `${who} added ${data.cargo || "cargo"} to ${cno}`,
      route: data.container_id
        ? { page: "container-log", params: { containerId: data.container_id } }
        : { page: "voyages" },
    };
  }

  // expenses — money reuses fmtPaise; amount is integer paise.
  if (table === "expenses") {
    const amount = `₹${fmtPaise(data.amount)}`;
    const cat = data.category ? ` (${data.category})` : "";
    return {
      ...base,
      Icon: Receipt,
      tone: data.type === "income" ? "green" : "neutral",
      text:
        op === "DELETE"
          ? `${who} deleted an expense${cat}`
          : `${who} ${op === "INSERT" ? "logged" : "updated"} ${amount}${cat}`,
      route: { page: "expenses", params: { focusId: entry.row_id } },
    };
  }

  // bookings — no text ref column; describe by parties where possible.
  if (table === "bookings") {
    return {
      ...base,
      Icon: FileText,
      text: `${who} ${
        op === "INSERT" ? "created" : op === "DELETE" ? "removed" : "updated"
      } a booking`,
      route: { page: "manifest" },
    };
  }

  // vessel_movements.
  if (table === "vessel_movements") {
    return {
      ...base,
      Icon: Navigation,
      text: `${who} logged ${data.event_type || "a movement"}${
        data.location ? ` at ${data.location}` : ""
      }`,
      route: { page: "manifest" },
    };
  }

  // voyages.
  if (table === "voyages") {
    const label = data.voyage_no || data.vessel || "voyage";
    return {
      ...base,
      Icon: Ship,
      text: `${who} ${
        op === "INSERT" ? "created" : op === "DELETE" ? "archived" : "updated"
      } voyage ${label}`,
      route: { page: "voyage-detail", params: { voyageId: entry.row_id } },
    };
  }

  // shippers / consignees.
  if (table === "shippers" || table === "consignees") {
    return {
      ...base,
      Icon: Users,
      text: `${who} ${op.toLowerCase()}d ${singular(table)} ${data.name || ""}`.trim(),
      route: { page: "masters" },
    };
  }

  // Fallback — "{name} {op}d a {singular}".
  return {
    ...base,
    Icon: Activity,
    text: `${who} ${op.toLowerCase()}d a ${singular(table)}`,
    route: { page: TABLE_SECTION[table] || "dashboard" },
  };
}
