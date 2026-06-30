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

// Searchable combo box over the shippers/consignees master list, with an
// inline "add new" form when there's no match. `kind` is "shipper" or
// "consignee" — only changes the extra fields shown on the add-new form.
export default function ShipperConsigneeSelect({
  kind, // "shipper" | "consignee"
  items = [],
  name,
  onSelect, // ({ id, name }) => void
  onCreate, // (draft) => Promise<{ id, name }>
}) {
  const [query, setQuery] = useState(name || "");
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ name: "", address: "", gstin: "", iecCode: "", country: "IN" });
  const boxRef = useRef();

  useEffect(() => setQuery(name || ""), [name]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const matches = query
    ? items.filter((i) => i.name.toLowerCase().includes(query.toLowerCase()))
    : items;

  const choose = (item) => {
    setQuery(item.name);
    onSelect({ id: item.id, name: item.name });
    setOpen(false);
    setAdding(false);
  };

  const startAdd = () => {
    setDraft({ name: query, address: "", gstin: "", iecCode: "", country: "IN" });
    setAdding(true);
  };

  const submitAdd = async () => {
    if (!draft.name.trim()) return;
    const created = await onCreate(draft);
    if (created) choose(created);
  };

  return (
    <div ref={boxRef} style={{ position: "relative" }}>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          onSelect({ id: null, name: e.target.value });
        }}
        onFocus={() => setOpen(true)}
        placeholder={kind === "shipper" ? "shipper" : "consignee"}
        style={inputStyle}
      />

      {open && !adding && (
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
          {matches.map((item) => (
            <div
              key={item.id}
              onClick={() => choose(item)}
              style={{
                padding: "7px 10px",
                fontFamily: theme.font.mono,
                fontSize: 12,
                color: theme.color.ink,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.surfaceMuted)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {item.name}
            </div>
          ))}
          <div
            onClick={startAdd}
            style={{
              padding: "7px 10px",
              fontFamily: theme.font.mono,
              fontSize: 12,
              color: theme.color.amber,
              cursor: "pointer",
              borderTop: matches.length ? `1px solid ${theme.color.border}` : "none",
            }}
          >
            + Add as new {kind}
          </div>
        </div>
      )}

      {adding && (
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
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            boxShadow: theme.shadow.raised,
            width: 260,
          }}
        >
          <input
            placeholder="name"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="address"
            value={draft.address}
            onChange={(e) => setDraft({ ...draft, address: e.target.value })}
            style={inputStyle}
          />
          {kind === "shipper" ? (
            <>
              <input
                placeholder="GSTIN"
                value={draft.gstin}
                onChange={(e) => setDraft({ ...draft, gstin: e.target.value })}
                style={inputStyle}
              />
              <input
                placeholder="IEC code"
                value={draft.iecCode}
                onChange={(e) => setDraft({ ...draft, iecCode: e.target.value })}
                style={inputStyle}
              />
            </>
          ) : (
            <input
              placeholder="country"
              value={draft.country}
              onChange={(e) => setDraft({ ...draft, country: e.target.value })}
              style={inputStyle}
            />
          )}
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => setAdding(false)}
              style={{
                background: "none",
                border: `1px solid ${theme.color.border}`,
                color: theme.color.slate,
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: theme.font.mono,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              cancel
            </button>
            <button
              type="button"
              onClick={submitAdd}
              style={{
                background: theme.color.green,
                border: "none",
                color: theme.color.white,
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: theme.font.mono,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
