import { useEffect, useState } from "react";
import { Plus, FileDown, Ban } from "lucide-react";
import { theme } from "../theme";
import { Card, Pill, StatusBadge } from "../components/ui";
import { useToast } from "../components/Toast";
import { useRouter } from "../context/RouterContext";
import { formatDDMMYY } from "../lib/format";
import { getSignedDocumentUrl } from "../lib/documents";
import {
  fetchCartingOrders,
  createCartingOrder,
  voidCartingOrder,
} from "../lib/cartingOrders";

// List of Export Carting Orders for a voyage. New/standalone module living
// alongside Documents — the per-container entry surface is CartingOrderDetailView.
export default function CartingOrdersView({ app }) {
  const { state, user, orgSettings } = app;
  const { navigate } = useRouter();
  const { showToast } = useToast();

  const voyages = (state.voyages || []).filter((v) => !v.archived);
  const [voyageId, setVoyageId] = useState(state.activeVoyageId || voyages[0]?.id || "");
  const [orders, setOrders] = useState(null);
  const [creating, setCreating] = useState(false);

  const voyage = voyages.find((v) => v.id === voyageId) || null;

  const reload = () => {
    if (!voyageId) {
      setOrders([]);
      return;
    }
    fetchCartingOrders(voyageId).then(({ data, error }) => {
      if (error) {
        console.warn("[carting] fetch failed:", error.message);
        setOrders([]);
        return;
      }
      setOrders(data);
    });
  };

  useEffect(reload, [voyageId]);

  const onNew = async () => {
    if (!voyage || creating) return;
    setCreating(true);
    const { data, error } = await createCartingOrder({
      voyageId: voyage.id,
      pol: voyage.pol || orgSettings?.default_pol || "Kolkata",
      pod: voyage.pod || orgSettings?.default_pod || "Port Blair",
      bookingNo: voyage.bookingRef || "",
      createdBy: user?.id,
    });
    setCreating(false);
    if (error || !data) {
      showToast(`Could not create order: ${error?.message || "unknown"}`, "error");
      return;
    }
    navigate("carting-detail", { orderId: data.id, voyageId: voyage.id });
  };

  const onVoid = async (order) => {
    if (!window.confirm("Void this carting order? This cannot be undone.")) return;
    const { error } = await voidCartingOrder(order.id);
    if (error) {
      showToast(`Void failed: ${error.message}`, "error");
      return;
    }
    showToast("Carting order voided", "success");
    reload();
  };

  const download = async (order) => {
    if (!order.pdfPath) return;
    const { url, error } = await getSignedDocumentUrl(order.pdfPath);
    if (error || !url) {
      showToast("Could not create download link", "error");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  return (
    <div style={{ minHeight: "100%", color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 40px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, marginBottom: 4 }}>
              CARTING ORDERS
            </div>
            <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
              Export Carting Orders to the port DDMO — issued orders are frozen snapshots.
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <Pill
              value={voyageId}
              onChange={(e) => setVoyageId(e.target.value)}
              options={voyages.map((v) => ({ value: v.id, label: `${v.voyageNo || "—"} · ${v.vessel || ""}` }))}
            />
            <button
              onClick={onNew}
              disabled={!voyage || creating}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                background: theme.color.amber,
                border: "none",
                color: "#fff",
                fontFamily: theme.font.condensed,
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                padding: "9px 16px",
                borderRadius: theme.radius.sm,
                cursor: !voyage || creating ? "not-allowed" : "pointer",
                opacity: !voyage || creating ? 0.5 : 1,
              }}
            >
              <Plus size={15} /> New order
            </button>
          </div>
        </div>

        {orders === null ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>Loading…</div>
        ) : orders.length === 0 ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>
            No carting orders yet for this voyage.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map((o) => (
              <Card
                key={o.id}
                onClick={o.status === "draft" ? () => navigate("carting-detail", { orderId: o.id, voyageId }) : undefined}
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 14,
                  opacity: o.status === "void" ? 0.6 : 1,
                  cursor: o.status === "draft" ? "pointer" : "default",
                }}
              >
                <div style={{ flex: 1, minWidth: 160, fontFamily: theme.font.mono, fontSize: 13, textDecoration: o.status === "void" ? "line-through" : "none" }}>
                  {o.snapshot?.number || "— draft —"}
                  <div style={{ fontSize: 11, color: theme.color.slate, marginTop: 2 }}>
                    {o.bookingNo ? `Booking ${o.bookingNo} · ` : ""}
                    {o.pol} → {o.pod}
                  </div>
                </div>
                <div style={{ width: 100, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                  {formatDDMMYY(o.orderDate)}
                </div>
                <div style={{ width: 90 }}>
                  <StatusBadge status={o.status.toUpperCase()} size="sm" />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {o.pdfPath && (
                    <button onClick={(e) => { e.stopPropagation(); download(o); }} title="Download" style={iconBtn}>
                      <FileDown size={14} />
                    </button>
                  )}
                  {o.status !== "void" && (
                    <button onClick={(e) => { e.stopPropagation(); onVoid(o); }} title="Void" style={{ ...iconBtn, color: theme.color.red }}>
                      <Ban size={14} />
                    </button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn = {
  background: theme.color.surfaceMuted,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.inkSoft,
  borderRadius: theme.radius.sm,
  padding: 7,
  cursor: "pointer",
  display: "flex",
};
