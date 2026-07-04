import { useEffect, useMemo, useState } from "react";
import { theme } from "../../theme";
import { useIsMobile } from "../../hooks/useIsMobile";
import { Pill, Input } from "../ui";
import { useToast } from "../Toast";
import {
  createDraftDocument,
  issueDocument,
  fetchLatestIssuedDocument,
} from "../../lib/documents";
import { buildHblPayload, generateHblPdf } from "../../lib/pdf/hbl";
import { buildArrivalNoticePayload, generateArrivalNoticePdf } from "../../lib/pdf/arrivalNotice";
import { buildDeliveryOrderPayload, generateDeliveryOrderPdf } from "../../lib/pdf/deliveryOrder";

const TITLES = {
  hbl: "House Bill of Lading",
  arrival_notice: "Arrival Notice",
  delivery_order: "Delivery Order",
};

const fieldLabel = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: theme.color.slate,
  marginBottom: 4,
  display: "block",
};

function Field({ label, children }) {
  return (
    <div>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

// Generates the draft/preview PDF + payload for `type` from live data, and —
// on Issue — freezes that same payload into the documents row. HBL, Arrival
// Notice and Delivery Order all share this shell; only the field set and
// generator function differ.
export default function DocumentDraftModal({ app, voyage, type, initialContainerId, onClose }) {
  const { state, user } = app;
  const { showToast } = useToast();

  const sealedContainers = (voyage.containers || []).filter((c) => c.sealed);
  const [containerId, setContainerId] = useState(
    initialContainerId || sealedContainers[0]?.id || ""
  );
  const [draftId, setDraftId] = useState(null);
  const [hblDocument, setHblDocument] = useState(undefined); // undefined = loading, null = none found
  const [overrides, setOverrides] = useState({});
  const [issuing, setIssuing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const isMobile = useIsMobile();

  const container = voyage.containers.find((c) => c.id === containerId) || null;
  const line = container?.lines?.[0] || null;
  const shipperRecord = state.shippers.find((s) => s.id === line?.shipperId) || null;
  const consigneeRecord = state.consignees.find((c) => c.id === line?.consigneeId) || null;
  const booking =
    (voyage.bookings || []).find((b) => b.id === line?.bookingId) || voyage.bookings?.[0] || null;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // AN / DO reference the container's latest issued HBL — gate on it existing.
  useEffect(() => {
    if (type === "hbl" || !containerId) {
      setHblDocument(null);
      return;
    }
    let cancelled = false;
    setHblDocument(undefined);
    fetchLatestIssuedDocument({ containerId, type: "hbl" }).then(({ data }) => {
      if (!cancelled) setHblDocument(data);
    });
    return () => {
      cancelled = true;
    };
  }, [type, containerId]);

  // Create the draft row as soon as we have a valid container. Switching
  // containers starts a fresh draft (the old one is left as an abandoned
  // draft row, which is harmless — never surfaced except in the Documents list).
  useEffect(() => {
    if (!containerId || hblDocument === undefined) return;
    if (type !== "hbl" && !hblDocument) return; // blocked — no HBL to reference yet
    let cancelled = false;
    createDraftDocument({ type, voyageId: voyage.id, containerId, bookingId: booking?.id }).then(
      ({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[documents] draft create failed:", error.message);
          return;
        }
        setDraftId(data.id);
      }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, containerId, hblDocument]);

  const payload = useMemo(() => {
    if (!container) return null;
    if (type === "hbl") return buildHblPayload(voyage, container, booking, { shipperRecord, consigneeRecord, overrides });
    if (hblDocument === undefined || hblDocument === null) return null;
    if (type === "arrival_notice")
      return buildArrivalNoticePayload(voyage, container, { hblDocument, consigneeRecord, overrides });
    return buildDeliveryOrderPayload(voyage, container, { hblDocument, consigneeRecord, overrides });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, voyage, container, booking, shipperRecord, consigneeRecord, hblDocument, overrides]);

  useEffect(() => {
    if (!payload) {
      setPreviewUrl(null);
      return;
    }
    const generator = { hbl: generateHblPdf, arrival_notice: generateArrivalNoticePdf, delivery_order: generateDeliveryOrderPdf }[type];
    const blob = generator(payload, { number: "DRAFT" });
    const url = URL.createObjectURL(blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [payload, type]);

  const set = (k) => (v) => setOverrides((o) => ({ ...o, [k]: v }));

  const onIssue = async () => {
    if (!draftId || !payload) return;
    setIssuing(true);
    const generator = { hbl: generateHblPdf, arrival_notice: generateArrivalNoticePdf, delivery_order: generateDeliveryOrderPdf }[type];
    const pdfBlob = generator(payload, { number: "PENDING", issuedAt: new Date().toISOString() });
    const { data, error } = await issueDocument(draftId, { type, payload, pdfBlob, issuedBy: user?.id });
    setIssuing(false);
    if (error) {
      showToast(`Issue failed: ${error.message}`, "error");
      return;
    }
    showToast(`${TITLES[type]} issued — ${data.number}`, "success");
    onClose?.();
  };

  const blocked = type !== "hbl" && hblDocument === null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(2,4,7,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? 0 : 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 920,
          maxHeight: isMobile ? "100dvh" : "92vh",
          height: isMobile ? "100dvh" : undefined,
          borderRadius: isMobile ? 0 : theme.radius.card,
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.raised,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.color.border}`,
          }}
        >
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 22, color: theme.color.ink }}>
            {TITLES[type]} — {voyage.voyageNo}
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: theme.color.slate, cursor: "pointer", fontFamily: theme.font.mono, fontSize: 13 }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, minHeight: 0 }}>
          <div
            style={{
              width: isMobile ? "100%" : 280,
              flexShrink: 0,
              padding: 18,
              borderRight: isMobile ? "none" : `1px solid ${theme.color.border}`,
              borderBottom: isMobile ? `1px solid ${theme.color.border}` : "none",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <Field label="Container">
              <Pill
                value={containerId}
                onChange={(e) => setContainerId(e.target.value)}
                options={sealedContainers.map((c) => ({ value: c.id, label: c.number || "Unassigned" }))}
                style={{ width: "100%" }}
              />
              {sealedContainers.length === 0 && (
                <div style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.red, marginTop: 6 }}>
                  No sealed containers on this voyage yet.
                </div>
              )}
            </Field>

            {blocked && (
              <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red, background: theme.color.redSoft, borderRadius: theme.radius.sm, padding: 10 }}>
                Issue the House Bill of Lading for this container first.
              </div>
            )}

            {type === "hbl" && (
              <>
                <Field label="Freight Terms">
                  <Pill
                    value={overrides.freightTerm || (booking?.freightStatus === "paid" ? "Prepaid" : "Collect")}
                    onChange={(e) => set("freightTerm")(e.target.value)}
                    options={["Prepaid", "Collect"]}
                    style={{ width: "100%" }}
                  />
                </Field>
                <Field label="Number of Originals">
                  <Input type="number" min={1} value={overrides.numberOfOriginals ?? 3} onChange={(e) => set("numberOfOriginals")(Number(e.target.value))} />
                </Field>
                <Field label="Shipped on Board Date">
                  <Input type="date" value={(overrides.shippedOnBoardDate || new Date().toISOString()).slice(0, 10)} onChange={(e) => set("shippedOnBoardDate")(e.target.value)} />
                </Field>
              </>
            )}

            {type === "arrival_notice" && (
              <>
                <Field label="ETA">
                  <Input type="date" value={(overrides.eta || "").slice(0, 10)} onChange={(e) => set("eta")(e.target.value)} />
                </Field>
                <Field label="Charges Due">
                  <Input value={overrides.chargesDue || ""} onChange={(e) => set("chargesDue")(e.target.value)} placeholder="To be advised" />
                </Field>
              </>
            )}

            {type === "delivery_order" && (
              <>
                <Field label="Release To">
                  <Input value={overrides.releaseTo || line?.consignee || ""} onChange={(e) => set("releaseTo")(e.target.value)} placeholder="Consignee / CHA name" />
                </Field>
                <Field label="Valid Until">
                  <Input type="date" value={(overrides.validityDate || "").slice(0, 10)} onChange={(e) => set("validityDate")(e.target.value)} />
                </Field>
                <Field label="Release Conditions / Remarks">
                  <textarea
                    value={overrides.remarks || ""}
                    onChange={(e) => set("remarks")(e.target.value)}
                    rows={3}
                    style={{ width: "100%", boxSizing: "border-box", fontFamily: theme.font.mono, fontSize: 12, border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.input, padding: 10 }}
                  />
                </Field>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.inkSoft }}>
                  <input type="checkbox" checked={!!overrides.chargesCleared} onChange={(e) => set("chargesCleared")(e.target.checked)} />
                  Charges cleared (advisory — not enforced)
                </label>
              </>
            )}

            <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
              {!online && (
                <div style={{ fontFamily: theme.font.mono, fontSize: 10, color: theme.color.slate }}>
                  Offline — issuing requires a live connection.
                </div>
              )}
              <button
                onClick={onIssue}
                disabled={!draftId || !payload || issuing || blocked || !online}
                style={{
                  background: theme.color.amber,
                  border: "none",
                  color: "#fff",
                  fontFamily: theme.font.condensed,
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  padding: "10px 16px",
                  borderRadius: theme.radius.sm,
                  cursor: !draftId || !payload || issuing || blocked || !online ? "not-allowed" : "pointer",
                  opacity: !draftId || !payload || issuing || blocked || !online ? 0.5 : 1,
                }}
              >
                {issuing ? "Issuing…" : "Issue Document"}
              </button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: isMobile ? 360 : 0, background: theme.color.canvas, padding: 12 }}>
            {previewUrl ? (
              <iframe title="Document preview" src={previewUrl} style={{ width: "100%", height: "100%", border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, background: "#fff" }} />
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
                {blocked ? "Select a container with an issued HBL." : "Select a sealed container to preview."}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
