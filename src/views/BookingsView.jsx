import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { TOKENS } from "../data/statusHelpers";
import { FREIGHT_STATUS_COLORS, PAYMENT_STATUS_COLORS } from "../data/manifestHelpers";
import CreateBookingModal from "../components/CreateBookingModal";
import { useToast } from "../components/Toast";
import BookingDetailView from "./BookingDetailView";

function Badge({ status, colors }) {
  const color = colors[status] || TOKENS.steel;
  return (
    <span
      style={{
        fontFamily: TOKENS.mono,
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

function BookingRow({ booking, shipper, consignee, onOpen }) {
  return (
    <div
      onClick={onOpen}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1.3fr 1.3fr 1fr 1fr 1fr 28px",
        alignItems: "center",
        gap: 12,
        padding: "14px 18px",
        borderBottom: `1px solid ${TOKENS.border}`,
        cursor: "pointer",
      }}
    >
      <div style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel }}>{booking.bookingDate}</div>
      <div style={{ fontFamily: TOKENS.condensed, fontWeight: 700, fontSize: 14, color: "#e8eef4" }}>
        {shipper?.name || "—"}
      </div>
      <div style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel }}>{consignee?.name || "—"}</div>
      <Badge status={booking.freightStatus} colors={FREIGHT_STATUS_COLORS} />
      <Badge status={booking.paymentStatus} colors={PAYMENT_STATUS_COLORS} />
      <div style={{ fontFamily: TOKENS.condensed, fontWeight: 700, fontSize: 14, color: TOKENS.amber }}>
        {booking.freightAmount != null ? `${booking.freightAmount} ${booking.freightCurrency}` : "—"}
      </div>
      <ChevronRight size={16} color={TOKENS.steel} />
    </div>
  );
}

export default function BookingsView({ app, voyage }) {
  const { state, createBookingEntry, updateBookingEntry, removeBookingEntry, createShipperEntry, createConsigneeEntry } = app;
  const { showToast } = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  if (!voyage) {
    return (
      <div style={{ padding: "40px 18px", textAlign: "center", fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel }}>
        No active voyage selected.
      </div>
    );
  }

  const bookings = voyage.bookings || [];
  const selected = bookings.find((b) => b.id === selectedId);

  if (selected) {
    return (
      <>
        <BookingDetailView
          app={app}
          voyage={voyage}
          booking={selected}
          onBack={() => setSelectedId(null)}
          onEdit={() => setEditing(selected)}
          onDelete={() => {
            removeBookingEntry(voyage.id, selected.id);
            setSelectedId(null);
            showToast("Booking deleted", "success");
          }}
        />
        {editing && (
          <CreateBookingModal
            booking={editing}
            shippers={state.shippers}
            consignees={state.consignees}
            onClose={() => setEditing(null)}
            onCreateShipper={createShipperEntry}
            onCreateConsignee={createConsigneeEntry}
            onSubmit={(patch) => {
              updateBookingEntry(voyage.id, editing.id, patch);
              setEditing(null);
              showToast("Booking updated", "success");
            }}
          />
        )}
      </>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 18px 40px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: 28, color: "#e8eef4" }}>
          BOOKINGS — {voyage.voyageNo}
        </div>
        <button
          onClick={() => setCreating(true)}
          style={{
            background: TOKENS.amber,
            border: "none",
            color: TOKENS.bg,
            fontFamily: TOKENS.condensed,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            padding: "9px 16px",
            cursor: "pointer",
          }}
        >
          + New Booking
        </button>
      </div>

      <div style={{ marginTop: 16, border: `1px solid ${TOKENS.border}` }}>
        {bookings.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: 24, color: "#1c2d42" }}>
              NO BOOKINGS YET
            </div>
            <div style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.steel, marginTop: 8 }}>
              Create a booking to link shippers, consignees, and freight terms to this voyage.
            </div>
          </div>
        ) : (
          bookings.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              shipper={state.shippers.find((s) => s.id === b.shipperId)}
              consignee={state.consignees.find((c) => c.id === b.consigneeId)}
              onOpen={() => setSelectedId(b.id)}
            />
          ))
        )}
      </div>

      {creating && (
        <CreateBookingModal
          shippers={state.shippers}
          consignees={state.consignees}
          onClose={() => setCreating(false)}
          onCreateShipper={createShipperEntry}
          onCreateConsignee={createConsigneeEntry}
          onSubmit={async (draft) => {
            const b = await createBookingEntry(voyage.id, draft);
            setCreating(false);
            if (b) showToast("Booking created", "success");
          }}
        />
      )}
    </div>
  );
}
