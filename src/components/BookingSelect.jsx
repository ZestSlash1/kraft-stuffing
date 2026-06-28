import { useEffect, useRef, useState } from "react";
import { TOKENS } from "../data/statusHelpers";

const inputStyle = {
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  color: "#e2e8f0",
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: TOKENS.mono,
  fontSize: 13,
  width: "100%",
};

const bookingLabel = (b, shippers = [], consignees = []) => {
  const shipper = shippers.find((s) => s.id === b.shipperId)?.name;
  const consignee = consignees.find((c) => c.id === b.consigneeId)?.name;
  return [b.bookingDate, shipper, consignee].filter(Boolean).join(" • ");
};

// Searchable combo box over the voyage's bookings — used to optionally link a
// stuffing line to a booking. No "add new" affordance; bookings are created
// from the Manifest screens.
export default function BookingSelect({ bookings = [], shippers = [], consignees = [], bookingId, onSelect }) {
  const selected = bookings.find((b) => b.id === bookingId);
  const [query, setQuery] = useState(selected ? bookingLabel(selected, shippers, consignees) : "");
  const [open, setOpen] = useState(false);
  const boxRef = useRef();

  useEffect(() => {
    const b = bookings.find((x) => x.id === bookingId);
    setQuery(b ? bookingLabel(b, shippers, consignees) : "");
  }, [bookingId, bookings, shippers, consignees]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = query
    ? bookings.filter((b) =>
        bookingLabel(b, shippers, consignees).toLowerCase().includes(query.toLowerCase())
      )
    : bookings;

  const choose = (b) => {
    setQuery(b ? bookingLabel(b, shippers, consignees) : "");
    onSelect(b ? b.id : null);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="none"
        style={inputStyle}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            background: TOKENS.surface,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 4,
            maxHeight: 180,
            overflowY: "auto",
            boxShadow: "0 8px 20px -8px rgba(0,0,0,0.6)",
          }}
        >
          <div
            onClick={() => choose(null)}
            style={{
              padding: "7px 10px",
              fontFamily: TOKENS.mono,
              fontSize: 12,
              color: TOKENS.steel,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.bg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            none
          </div>
          {matches.map((b) => (
            <div
              key={b.id}
              onClick={() => choose(b)}
              style={{
                padding: "7px 10px",
                fontFamily: TOKENS.mono,
                fontSize: 12,
                color: "#e2e8f0",
                cursor: "pointer",
                borderTop: `1px solid ${TOKENS.border}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = TOKENS.bg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {bookingLabel(b, shippers, consignees)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
