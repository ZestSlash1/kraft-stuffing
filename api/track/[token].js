// GET /api/track/:token — PUBLIC, no auth. The only public surface for a booking.
// (TRACKING_AND_NOTIFICATIONS §A.1/§A.3)
//
// Security contract:
//  - Lookup by tracking_token ONLY. No booking ids accepted, no list/enumeration.
//  - Returns a hand-picked field WHITELIST built here as an explicit projection.
//    Adding a field is a deliberate code change — never `select *`, never a join
//    that drags in financials / values / weights beyond gross / party contacts /
//    mail / internal notes.
//  - Uses adminClient() (service role) with its OWN token check. No RLS policy on
//    any existing table is weakened; public access exists only through this file.
//  - Unknown / malformed tokens get an identical 404 (no enumeration signal). No
//    per-IP rate limiter exists in this repo yet — flagged as a gap (§A.1), not
//    built here.
import { adminClient, httpError, withErrors } from "../_lib/auth.js";

// A minted token is 22 url-safe chars (~131 bits). Reject anything implausible
// before touching the DB so unknown/garbage tokens all fall to the same 404.
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

function notFound(res) {
  return res.status(404).json({ error: "Not found" });
}

// Human-facing reference: bookings carry no dedicated number, so derive a stable,
// non-sequential short ref from the uuid (last segment, upper) — never the token.
function bookingRef(id) {
  const tail = (id || "").split("-").pop() || "";
  return `KRAFT-${tail.slice(-6).toUpperCase()}`;
}

export default withErrors(async (req, res) => {
  if (req.method !== "GET") throw httpError(405, "Method not allowed");
  const token = (req.query.token || "").toString();
  if (!TOKEN_RE.test(token)) return notFound(res);

  const db = adminClient();

  // ── Token-only lookup. Voided bookings never expose a link. ──
  const { data: booking, error } = await db
    .from("bookings")
    .select("id, voyage_id, booking_date, created_at, tracking_token")
    .eq("tracking_token", token)
    .maybeSingle();
  if (error) throw httpError(500, "Lookup failed");
  if (!booking || !booking.tracking_token) return notFound(res);

  // ── Voyage (whitelisted columns only). ──
  const { data: voyage } = await db
    .from("voyages")
    .select("vessel, voyage_no, pol, pod, etd, status")
    .eq("id", booking.voyage_id)
    .maybeSingle();

  // ── Lines linked to THIS booking — only fields the timeline / gross weight need. ──
  const { data: lines } = await db
    .from("stuffing_lines")
    .select("container_id, qty, unit, unit_weight_kg, logged_at")
    .eq("booking_id", booking.id);
  const rows = lines || [];

  // ── Containers carrying this booking's cargo (number + size + seal only). ──
  const containerIds = [...new Set(rows.map((l) => l.container_id).filter(Boolean))];
  let containers = [];
  if (containerIds.length) {
    const { data } = await db
      .from("containers")
      .select("id, number, size, sealed, sealed_at")
      .in("id", containerIds);
    containers = (data || []).map((c) => ({
      number: c.number || "—",
      size: c.size || "20",
      sealed: !!c.sealed,
      sealed_at: c.sealed_at || null,
    }));
  }

  // ── Actual vessel movements (the honest timeline axis). ──
  const { data: mv } = await db
    .from("vessel_movements")
    .select("event_type, event_date, location")
    .eq("voyage_id", booking.voyage_id)
    .order("event_date", { ascending: true });
  const movements = mv || [];
  const firstOf = (...types) =>
    movements.find((m) => types.includes(m.event_type)) || null;

  // ── Derived milestones — reached only when the data actually supports it. ──
  const loggedAts = rows.map((l) => l.logged_at).filter(Boolean).sort();
  const sealedAts = containers.filter((c) => c.sealed).map((c) => c.sealed_at).filter(Boolean).sort();
  const allSealed = containers.length > 0 && containers.every((c) => c.sealed);
  const sailed = firstOf("sailed");
  const inTransit = firstOf("in_transit");
  const arrived = firstOf("berthed", "discharging", "discharged");
  const departed = voyage?.status === "COMPLETED" || !!sailed;

  const timeline = [
    { key: "booked", label: "Booked", reached: true, date: booking.booking_date || booking.created_at },
    { key: "stuffed", label: "Stuffed", reached: loggedAts.length > 0, date: loggedAts[0] || null },
    { key: "sealed", label: "Sealed", reached: allSealed, date: allSealed ? sealedAts[sealedAts.length - 1] : null },
    {
      key: "departed",
      label: "Departed",
      reached: departed,
      // Show ETD as "Expected" only while not yet departed (§A.3 — no arrival ETA math).
      date: sailed?.event_date || (departed ? null : null),
      expected: !departed && voyage?.etd ? voyage.etd : null,
    },
    { key: "in_transit", label: "In transit", reached: !!inTransit, date: inTransit?.event_date || null },
    { key: "arrived", label: "Arrived", reached: !!arrived, date: arrived?.event_date || null },
    // 'Delivered' intentionally omitted — no backing field (see findings §c).
  ];

  // Gross weight only (default include per §A.3). Never tare/VGM/cml.
  const grossKg = rows.reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unit_weight_kg || 0),
    0
  );

  // ── Explicit whitelist response. Nothing outside this object is emitted. ──
  return res.status(200).json({
    reference: bookingRef(booking.id),
    route: { pol: voyage?.pol || null, pod: voyage?.pod || null },
    vessel: voyage?.vessel || null,
    voyageNo: voyage?.voyage_no || null,
    containers,
    grossKg: grossKg > 0 ? Math.round(grossKg) : null,
    timeline,
    lastUpdated: new Date().toISOString(),
  });
});
