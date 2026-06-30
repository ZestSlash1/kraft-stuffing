import { useEffect, useRef, useState } from "react";
import { theme } from "../theme";

const inputStyle = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.ink,
  borderRadius: 4,
  padding: "8px 10px",
  fontFamily: theme.font.mono,
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
            background: theme.color.surface,
            border: `1px solid ${theme.color.border}`,
            borderRadius: 4,
            maxHeight: 180,
            overflowY: "auto",
            boxShadow: theme.shadow.raised,
          }}
        >
          <div
            onClick={() => choose(null)}
            style={{
              padding: "7px 10px",
              fontFamily: theme.font.mono,
              fontSize: 12,
              color: theme.color.slate,
              cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.surfaceMuted)}
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
                fontFamily: theme.font.mono,
                fontSize: 12,
                color: theme.color.ink,
                cursor: "pointer",
                borderTop: `1px solid ${theme.color.border}`,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.surfaceMuted)}
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
