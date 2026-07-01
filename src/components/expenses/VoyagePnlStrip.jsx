import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { theme } from "../../theme";
import { fetchExpensesByVoyage, fromDbExpense } from "../../lib/db";
import { fmtPaise, fmtPct, pnlOf } from "../../views/expenses/expenseHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// VoyagePnlStrip — compact Revenue / Cost / Margin / Margin % readout for a
// single voyage, shown on the Voyage detail page (Phase 6). This is the
// highest-value placement: the P&L a trader checks per sailing lives where they
// already manage the voyage. "+ Add entry" jumps to Expenses with the add form
// pre-tagged to this voyage.
// ─────────────────────────────────────────────────────────────────────────────

const label = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: theme.color.slate,
};

function Figure({ title, paise, pct, tone }) {
  const negative = tone === "margin" && Number(paise) < 0;
  const color =
    tone === "margin"
      ? negative
        ? theme.color.red
        : theme.color.green
      : theme.color.ink;
  return (
    <div>
      <div style={label}>{title}</div>
      <div
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 24,
          lineHeight: 1,
          color,
          marginTop: 3,
        }}
      >
        {pct !== undefined ? (
          fmtPct(pct)
        ) : (
          <>
            <span style={{ color: theme.color.slate, fontWeight: 400 }}>₹</span>
            {fmtPaise(Math.abs(paise))}
            {negative ? "−" : ""}
          </>
        )}
      </div>
    </div>
  );
}

export default function VoyagePnlStrip({ voyageId, onAddEntry }) {
  const [pnl, setPnl] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!voyageId) return;
    setLoaded(false);
    fetchExpensesByVoyage(voyageId).then(({ data, error }) => {
      if (!alive) return;
      if (error) {
        setLoaded(true); // fail quiet — offline / RLS; strip just shows zeros
        return;
      }
      setPnl(pnlOf((data || []).map(fromDbExpense)));
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [voyageId]);

  const p = pnl || { revenue: 0, cost: 0, margin: 0, marginPct: null };

  return (
    <div
      style={{
        marginTop: 16,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadow.card,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 16,
        opacity: loaded ? 1 : 0.6,
      }}
    >
      <div style={{ display: "flex", gap: 32, flexWrap: "wrap", alignItems: "flex-end" }}>
        <Figure title="Revenue" paise={p.revenue} />
        <Figure title="Cost" paise={p.cost} />
        <Figure title="Margin" paise={p.margin} tone="margin" />
        <Figure title="Margin %" pct={p.marginPct} />
      </div>
      <button
        onClick={onAddEntry}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: theme.color.surface,
          border: `1px solid ${theme.color.amber}`,
          color: theme.color.amber,
          borderRadius: theme.radius.input,
          padding: "8px 12px",
          fontFamily: theme.font.mono,
          fontSize: 11,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        <Plus size={14} /> Add entry
      </button>
    </div>
  );
}
