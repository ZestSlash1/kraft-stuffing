import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Box, Ship, FileText, Users, Receipt, CornerDownLeft, Clock, Plus } from "lucide-react";
import { theme } from "../theme";
import { C, glass } from "../ui/theme";
import { useRouter } from "../context/RouterContext";
import { globalSearch, ROUTE_FOR } from "../lib/search";
import { readRecentEntities } from "../lib/recentEntities";
import { useIsMobile } from "../hooks/useIsMobile";

// ─────────────────────────────────────────────────────────────────────────────
// CommandPalette — ⌘K / Ctrl+K global search. Frosted modal matching the light
// theme. Debounced query → global_search RPC (client-side fallback offline).
// Results grouped by type, ↑/↓/Enter keyboard nav, Enter routes via RouterContext.
// Mounted once in AppShell; a search icon in the nav also opens it.
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_META = {
  container: { label: "Containers", Icon: Box },
  voyage: { label: "Voyages", Icon: Ship },
  booking: { label: "Bookings", Icon: FileText },
  shipper: { label: "Shippers", Icon: Users },
  consignee: { label: "Consignees", Icon: Users },
  expense: { label: "Expenses", Icon: Receipt },
};
const TYPE_ORDER = ["container", "voyage", "booking", "shipper", "consignee", "expense"];

const EXPENSE_CACHE_KEY = "kraft-expenses-cache-v1";
const readExpenseCache = () => {
  try {
    return JSON.parse(localStorage.getItem(EXPENSE_CACHE_KEY)) || [];
  } catch {
    return [];
  }
};

export default function CommandPalette({ app, open, onClose }) {
  const { navigate } = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);
  const isMobile = useIsMobile();

  const fallbackData = useMemo(
    () => ({
      voyages: app?.state?.voyages || [],
      shippers: app?.state?.shippers || [],
      consignees: app?.state?.consignees || [],
      expenses: readExpenseCache(),
    }),
    [app?.state?.voyages, app?.state?.shippers, app?.state?.consignees, open]
  );

  // Reset + focus on open.
  useEffect(() => {
    if (open) {
      setQ("");
      setRows([]);
      setCursor(0);
      // focus after the modal paints
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced search.
  useEffect(() => {
    if (!open) return;
    clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const { rows: r, offline: off } = await globalSearch(q, fallbackData);
      setRows(r);
      setOffline(off);
      setCursor(0);
      setLoading(false);
    }, 180);
    return () => clearTimeout(debounceRef.current);
  }, [q, open, fallbackData]);

  // Flat, group-ordered list for keyboard nav.
  const ordered = useMemo(() => {
    const byType = {};
    for (const r of rows) (byType[r.type] ||= []).push(r);
    const flat = [];
    for (const t of TYPE_ORDER) for (const r of byType[t] || []) flat.push(r);
    // include any unknown types at the end
    for (const r of rows) if (!TYPE_ORDER.includes(r.type)) flat.push(r);
    return flat;
  }, [rows]);

  const go = useCallback(
    (row) => {
      if (!row) return;
      const target = ROUTE_FOR[row.type] || { page: "dashboard" };
      const params = target.param ? { [target.param]: row.id } : {};
      onClose();
      navigate(target.page, params);
    },
    [navigate, onClose]
  );

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, Math.max(ordered.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(ordered[cursor]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  // Group for render while preserving the flat index for highlight.
  let flatIndex = -1;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(2,4,7,0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: isMobile ? 0 : "12vh",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: isMobile ? "100%" : "min(560px, 92vw)",
          height: isMobile ? "100dvh" : undefined,
          ...glass(isMobile ? 0 : theme.radius.card),
          boxShadow: theme.shadow.raised,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Search field */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: `1px solid ${theme.color.border}`,
          }}
        >
          <Search size={18} color={theme.color.slate} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search containers, voyages, shippers, expenses…"
            style={{
              flex: 1,
              background: "none",
              border: "none",
              outline: "none",
              fontFamily: theme.font.mono,
              fontSize: 15,
              color: theme.color.ink,
            }}
          />
          <span
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              color: theme.color.slateFaint,
              border: `1px solid ${theme.color.border}`,
              borderRadius: 6,
              padding: "2px 6px",
            }}
          >
            ESC
          </span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: isMobile ? "none" : "52vh", flex: isMobile ? 1 : undefined, overflowY: "auto", padding: "6px 0" }}>
          {offline && (
            <div
              style={{
                fontFamily: theme.font.mono,
                fontSize: 10,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: C.warning,
                background: theme.color.amberSoft,
                padding: "6px 16px",
              }}
            >
              Offline — searching cached data
            </div>
          )}

          {loading && ordered.length === 0 ? (
            <Empty text="Searching…" />
          ) : !q.trim() ? (
            <IdleState app={app} onClose={onClose} navigate={navigate} go={go} />
          ) : ordered.length === 0 ? (
            <Empty text={`No results for “${q}”`} />
          ) : (
            TYPE_ORDER.filter((t) => ordered.some((r) => r.type === t))
              .concat(
                // unknown types bucket label under "Results"
                ordered.some((r) => !TYPE_ORDER.includes(r.type)) ? ["_other"] : []
              )
              .map((type) => {
                const meta = TYPE_META[type] || { label: "Results", Icon: Search };
                const groupRows = ordered.filter((r) =>
                  type === "_other" ? !TYPE_ORDER.includes(r.type) : r.type === type
                );
                return (
                  <div key={type}>
                    <div
                      style={{
                        fontFamily: theme.font.mono,
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        textTransform: "uppercase",
                        color: theme.color.slate,
                        padding: "8px 16px 4px",
                      }}
                    >
                      {meta.label}
                    </div>
                    {groupRows.map((row) => {
                      flatIndex += 1;
                      const idx = flatIndex;
                      const active = idx === cursor;
                      const Icon = meta.Icon;
                      return (
                        <button
                          key={`${row.type}-${row.id}`}
                          onMouseEnter={() => setCursor(idx)}
                          onClick={() => go(row)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            width: "100%",
                            textAlign: "left",
                            background: active ? theme.color.amberSoft : "transparent",
                            border: "none",
                            padding: "10px 16px",
                            cursor: "pointer",
                          }}
                        >
                          <Icon size={16} color={active ? theme.color.amber : theme.color.slate} />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                display: "block",
                                fontFamily: theme.font.mono,
                                fontSize: 13,
                                color: theme.color.ink,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {row.label || "—"}
                            </span>
                            {row.sublabel ? (
                              <span
                                style={{
                                  display: "block",
                                  fontFamily: theme.font.mono,
                                  fontSize: 10,
                                  color: theme.color.slate,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {row.sublabel}
                              </span>
                            ) : null}
                          </span>
                          {active && <CornerDownLeft size={13} color={theme.color.slate} />}
                        </button>
                      );
                    })}
                  </div>
                );
              })
          )}
        </div>
      </div>
    </div>
  );
}

// Empty-query state: last 5 visited entities + static quick actions.
function IdleState({ app, onClose, navigate, go }) {
  const recents = readRecentEntities();

  const activeVoyage =
    (app?.state?.voyages || []).find((v) => v.status === "LOADING" && !v.archived) ||
    (app?.state?.voyages || []).find((v) => !v.archived);

  const actions = [
    {
      label: "New Booking",
      run: () =>
        activeVoyage
          ? navigate("voyage-detail", { voyageId: activeVoyage.id, tab: "Bookings" })
          : navigate("voyages"),
    },
    { label: "New Expense", run: () => navigate("expenses") },
    { label: "Compose Mail", run: () => navigate("mail", { compose: true }) },
    { label: "New Voyage", run: () => navigate("voyages", { create: true }) },
  ];

  const rowStyle = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    width: "100%",
    textAlign: "left",
    background: "transparent",
    border: "none",
    padding: "10px 16px",
    cursor: "pointer",
    fontFamily: theme.font.mono,
    fontSize: 13,
    color: theme.color.ink,
  };
  const groupLabel = {
    fontFamily: theme.font.mono,
    fontSize: 9,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    color: theme.color.slate,
    padding: "8px 16px 4px",
  };

  return (
    <div>
      {recents.length > 0 && (
        <>
          <div style={groupLabel}>Recent</div>
          {recents.map((r) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => go({ type: r.type, id: r.id })}
              style={rowStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.amberSoft)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <Clock size={15} color={theme.color.slate} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label || r.id}</span>
            </button>
          ))}
        </>
      )}
      <div style={groupLabel}>Quick actions</div>
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => {
            onClose();
            a.run();
          }}
          style={rowStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.amberSoft)}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <Plus size={15} color={theme.color.amber} />
          {a.label}
        </button>
      ))}
    </div>
  );
}

function Empty({ text }) {
  return (
    <div
      style={{
        fontFamily: theme.font.mono,
        fontSize: 12,
        color: theme.color.slate,
        padding: "26px 16px",
        textAlign: "center",
      }}
    >
      {text}
    </div>
  );
}
