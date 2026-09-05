// Notification email template (§B.4). One tiny helper; every event type renders
// through it with different copy. Simple, reliable inline-styled HTML that also
// degrades to a readable plain-text fallback. The only image is the Kraft logo.
// SERVER-ONLY (used by the delivery worker).

const LOGO_URL = "https://portal.shafrina.com/kraft-logo.png";
const KRAFT_LINE = "Kraft Shipping & Logistics Pvt. Ltd., Kolkata";

// One-line statement + facts, per event type, from the frozen event payload.
function copyFor(eventType, p = {}) {
  switch (eventType) {
    case "document_issued":
      return {
        subject: `${(p.docType || "Document").toUpperCase()} ${p.number || ""} issued`.trim(),
        headline: `${(p.docType || "Document").toUpperCase()} ${p.number || ""} has been issued.`,
        facts: [
          ["Document", `${(p.docType || "").toUpperCase()} ${p.number || ""}`.trim()],
          ["Vessel", p.vessel || "—"],
          ["Voyage", p.voyageNo || "—"],
        ],
      };
    case "container_sealed":
      return {
        subject: `Container ${p.number || ""} sealed`.trim(),
        headline: `Container ${p.number || ""} has been sealed.`,
        facts: [
          ["Container", p.number || "—"],
          ["Voyage", p.voyageNo || "—"],
          ["Cargo", p.cargoSummary || "—"],
          ["Net weight", p.netMt ? `${p.netMt} MT` : "—"],
          ["Seal no", p.sealNo || "—"],
        ],
      };
    case "voyage_departed":
      return {
        subject: `Vessel departed ${p.pol || ""}`.trim(),
        headline: `Your shipment has departed ${p.pol || "the port of loading"}.`,
        facts: [
          ["Vessel", p.vessel || "—"],
          ["Voyage", p.voyageNo || "—"],
          ["Route", `${p.pol || "—"} → ${p.pod || "—"}`],
        ],
      };
    case "voyage_arrived":
      return {
        subject: `Vessel arrived ${p.pod || ""}`.trim(),
        headline: `Your shipment has arrived at ${p.pod || "the port of discharge"}.`,
        facts: [
          ["Vessel", p.vessel || "—"],
          ["Voyage", p.voyageNo || "—"],
          ["Route", `${p.pol || "—"} → ${p.pod || "—"}`],
        ],
      };
    default:
      return { subject: "Shipment update", headline: "There is an update on your shipment.", facts: [] };
  }
}

const esc = (s) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function renderNotificationEmail(event) {
  const p = event.payload || {};
  const { subject, headline, facts } = copyFor(event.event_type, p);
  const trackingUrl = p.trackingUrl || null;

  const factRows = facts
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#5a6b7d;font:12px monospace;white-space:nowrap">${esc(
          k
        )}</td><td style="padding:6px 0;color:#0f2438;font:13px monospace">${esc(v)}</td></tr>`
    )
    .join("");

  const trackBtn = trackingUrl
    ? `<tr><td style="padding:22px 0 4px"><a href="${esc(
        trackingUrl
      )}" style="display:inline-block;background:#0f2438;color:#fff;text-decoration:none;font:600 13px system-ui;padding:11px 20px;border-radius:8px">Track your shipment →</a></td></tr>`
    : "";

  const html = `<!doctype html><html><body style="margin:0;background:#eef3f8;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0">
    <tr><td style="background:#0f2438;padding:20px 24px">
      <img src="${LOGO_URL}" alt="Kraft Shipping & Logistics" height="34" style="display:block;filter:brightness(0) invert(1)">
    </td></tr>
    <tr><td style="padding:24px 24px 8px">
      <div style="font:700 19px/1.35 system-ui;color:#0f2438;margin-bottom:16px">${esc(headline)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0">${factRows}</table>
      <table role="presentation" cellpadding="0" cellspacing="0">${trackBtn}</table>
    </td></tr>
    <tr><td style="padding:18px 24px 22px;border-top:1px solid #e2e8f0;color:#8fa0b0;font:11px monospace">
      ${esc(KRAFT_LINE)}
    </td></tr>
  </table></td></tr></table></body></html>`;

  const text =
    `${headline}\n\n` +
    facts.map(([k, v]) => `${k}: ${v}`).join("\n") +
    (trackingUrl ? `\n\nTrack your shipment: ${trackingUrl}` : "") +
    `\n\n${KRAFT_LINE}`;

  return { subject, html, text };
}
