import { useState } from "react";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { formatIST } from "../data/statusHelpers";
import { theme } from "../theme";
import { FREIGHT_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "../data/manifestHelpers";
import ConfirmDialog from "../components/ConfirmDialog";

function Badge({ status, colors }) {
  const color = colors[status] || theme.color.slate;
  return (
    <span
      style={{
        fontFamily: theme.font.mono,
        fontSize: 9,
        letterSpacing: "0.1em",
        color,
        border: `1px solid ${color}`,
        padding: "3px 7px",
        whiteSpace: "nowrap",
      }}
    >
      {status.replace("_", " ").toUpperCase()}
    </span>
  );
}

const cell = { fontFamily: theme.font.mono, fontSize: 12, color: theme.color.inkSoft };

export default function BookingDetailView({ app, voyage, booking, onBack, onEdit, onDelete }) {
  const { state } = app;
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const shipper = state.shippers.find((s) => s.id === booking.shipperId);
  const consignee = state.consignees.find((c) => c.id === booking.consigneeId);

  const linkedLines = (voyage?.containers || []).flatMap((c) =>
    (c.lines || [])
      .filter((l) => l.bookingId === booking.id)
      .map((l) => ({ ...l, containerNumber: c.number }))
  );

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 18px 40px" }}>
      <button
        onClick={onBack}
        style={{
          background: "none",
          border: "none",
          color: theme.color.slate,
          fontFamily: theme.font.mono,
          fontSize: 12,
          display: "flex",
          alignItems: "center",
          gap: 6,
          cursor: "pointer",
          padding: 0,
          marginBottom: 16,
        }}
      >
        <ArrowLeft size={14} /> BACK TO BOOKINGS
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink }}>
            {shipper?.name || "—"} → {consignee?.name || "—"}
          </div>
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginTop: 4 }}>
            Booked {booking.bookingDate} · Voyage {voyage?.voyageNo || "—"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={onEdit}
            style={{
              background: "none",
              border: `1px solid ${theme.color.border}`,
              color: theme.color.slate,
              padding: "8px 12px",
              fontFamily: theme.font.mono,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            onClick={() => setConfirmingDelete(true)}
            style={{
              background: "none",
              border: `1px solid ${theme.color.red}`,
              color: theme.color.red,
              padding: "8px 12px",
              fontFamily: theme.font.mono,
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
            }}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          message="Delete this booking? Linked stuffing lines stay intact."
          confirmLabel="DELETE"
          confirmVariant="danger"
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => {
            setConfirmingDelete(false);
            onDelete();
          }}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 1,
          background: theme.color.border,
          marginTop: 20,
          border: `1px solid ${theme.color.border}`,
        }}
        className="booking-detail-grid"
      >
        {[
          ["Freight", `${booking.freightAmount != null ? booking.freightAmount : "—"} ${booking.freightCurrency || ""}`],
          ["Freight status", <Badge key="f" status={booking.freightStatus} colors={FREIGHT_STATUS_COLORS} />],
          ["Payment status", <Badge key="p" status={booking.paymentStatus} colors={PAYMENT_STATUS_COLORS} />],
          ["Notes", booking.notes || "—"],
        ].map(([l, v]) => (
          <div key={l} style={{ background: theme.color.surface, padding: 14 }}>
            <div style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.14em", color: theme.color.slate, marginBottom: 6 }}>
              {l.toUpperCase()}
            </div>
            <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 16, color: theme.color.ink }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 18, color: theme.color.ink, marginTop: 28, marginBottom: 10 }}>
        LINKED STUFFING LINES
      </div>

      {linkedLines.length === 0 ? (
        <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, padding: "16px 0" }}>
          No stuffing lines linked to this booking yet.
        </div>
      ) : (
        <div style={{ border: `1px solid ${theme.color.border}` }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "0.8fr 1.4fr 0.8fr 1fr 1fr 1.2fr",
              gap: 12,
              padding: "10px 14px",
              borderBottom: `1px solid ${theme.color.border}`,
              fontFamily: theme.font.mono,
              fontSize: 9,
              letterSpacing: "0.1em",
              color: theme.color.slate,
            }}
          >
            <div>CONTAINER</div>
            <div>CARGO</div>
            <div>QTY</div>
            <div>TRUCK</div>
            <div>E-WAY BILL</div>
            <div>LOGGED</div>
          </div>
          {linkedLines.map((l) => (
            <div
              key={l.id}
              style={{
                display: "grid",
                gridTemplateColumns: "0.8fr 1.4fr 0.8fr 1fr 1fr 1.2fr",
                gap: 12,
                padding: "10px 14px",
                borderBottom: `1px solid ${theme.color.border}`,
              }}
            >
              <div style={cell}>{l.containerNumber || "—"}</div>
              <div style={cell}>{l.cargo}</div>
              <div style={cell}>{l.qty} {l.unit}</div>
              <div style={cell}>{l.truckNo || "—"}</div>
              <div style={cell}>{l.ewayBillNo || "—"}</div>
              <div style={cell}>{formatIST(l.loggedAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
