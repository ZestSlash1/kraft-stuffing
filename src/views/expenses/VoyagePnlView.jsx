import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { theme } from "../../theme";
import { Pill } from "../../components/ui";
import {
  fmtPaise,
  fmtPct,
  untaggedPnl,
  voyageCostByCategory,
  voyagePnlRows,
} from "./expenseHelpers";

// ─────────────────────────────────────────────────────────────────────────────
// VoyagePnlView — per-voyage profit & loss (Phase 6). Revenue = income rows
// tagged to a voyage, cost = expense rows, margin = revenue − cost. All figures
// are integer paise, formatted to ₹ only at render. Clicking a voyage row drills
// down into the Ledger filtered to that voyage.
// ─────────────────────────────────────────────────────────────────────────────

const cell = {
  fontFamily: theme.font.mono,
  fontSize: 13,
  padding: "12px 14px",
  whiteSpace: "nowrap",
};

const headCell = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: theme.color.slate,
  padding: "0 14px 10px",
  textAlign: "right",
};

// ₹-prefixed paise, coloured green (positive) / red (negative) for margins.
function Money({ paise, tone }) {
  const negative = Number(paise) < 0;
  const color =
    tone === "margin"
      ? negative
        ? theme.color.red
        : theme.color.green
      : theme.color.ink;
  return (
    <span style={{ color, fontWeight: 600 }}>
      <span style={{ color: theme.color.slate, fontWeight: 400 }}>₹</span>
      {fmtPaise(Math.abs(paise))}
      {negative ? "−" : ""}
    </span>
  );
}

export default function VoyagePnlView({ expenses = [], voyages = [], onDrill }) {
  const rows = useMemo(() => voyagePnlRows(expenses, voyages), [expenses, voyages]);
  const untagged = useMemo(() => untaggedPnl(expenses), [expenses]);

  // Margin bar chart: sorted high → low, in rupees for a readable axis.
  const marginData = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.margin - a.margin)
        .map((r) => ({ label: r.label, margin: r.margin / 100 })),
    [rows]
  );

  // Cost-by-category breakdown for a chosen voyage (defaults to the first row).
  const [breakdownId, setBreakdownId] = useState(null);
  const activeId = breakdownId || rows[0]?.voyageId || null;
  const breakdown = useMemo(
    () =>
      voyageCostByCategory(expenses, activeId).map((c) => ({
        category: c.category,
        amount: c.amount / 100,
      })),
    [expenses, activeId]
  );

  if (rows.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "56px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 800,
            fontSize: 26,
            letterSpacing: "0.04em",
            color: theme.color.inkSoft,
          }}
        >
          NO VOYAGE-TAGGED ENTRIES
        </div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 12,
            letterSpacing: "0.06em",
            color: theme.color.slateFaint,
          }}
        >
          Link income &amp; expenses to a voyage to see its P&amp;L here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Roll-up table */}
      <div
        style={{
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.card,
          boxShadow: theme.shadow.card,
          overflowX: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: "left" }}>Voyage</th>
              <th style={headCell}>Revenue</th>
              <th style={headCell}>Cost</th>
              <th style={headCell}>Margin</th>
              <th style={headCell}>Margin %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.voyageId}
                onClick={() => onDrill?.(r.voyageId)}
                style={{ borderTop: `1px solid ${theme.color.border}`, cursor: "pointer" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.color.surfaceMuted)}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <td style={{ ...cell, textAlign: "left", color: theme.color.ink, fontWeight: 600 }}>
                  {r.label}
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={r.revenue} />
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={r.cost} />
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={r.margin} tone="margin" />
                </td>
                <td
                  style={{
                    ...cell,
                    textAlign: "right",
                    color: r.margin < 0 ? theme.color.red : theme.color.green,
                    fontWeight: 600,
                  }}
                >
                  {fmtPct(r.marginPct)}
                </td>
              </tr>
            ))}
            {untagged && (
              <tr style={{ borderTop: `1px solid ${theme.color.border}`, background: theme.color.surfaceMuted }}>
                <td style={{ ...cell, textAlign: "left", color: theme.color.slate, fontStyle: "italic" }}>
                  Untagged (overhead)
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={untagged.revenue} />
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={untagged.cost} />
                </td>
                <td style={{ ...cell, textAlign: "right" }}>
                  <Money paise={untagged.margin} tone="margin" />
                </td>
                <td style={{ ...cell, textAlign: "right", color: theme.color.slate }}>
                  {fmtPct(untagged.marginPct)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Margin per voyage */}
      <div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: theme.color.slate,
            marginBottom: 12,
          }}
        >
          Margin per voyage (₹)
        </div>
        <ResponsiveContainer width="100%" height={Math.max(140, marginData.length * 52)}>
          <BarChart data={marginData} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis
              type="number"
              tick={{ fontFamily: theme.font.mono, fontSize: 10, fill: theme.color.slate }}
              tickFormatter={(v) => `₹${fmtPaise(v * 100)}`}
            />
            <YAxis
              type="category"
              dataKey="label"
              width={150}
              tick={{ fontFamily: theme.font.mono, fontSize: 10, fill: theme.color.inkSoft }}
            />
            <Tooltip
              cursor={{ fill: theme.color.surfaceMuted }}
              formatter={(v) => [`₹${fmtPaise(v * 100)}`, "Margin"]}
              contentStyle={{
                fontFamily: theme.font.mono,
                fontSize: 12,
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.color.border}`,
              }}
            />
            <Bar dataKey="margin" radius={[0, 4, 4, 0]}>
              {marginData.map((d, i) => (
                <Cell key={i} fill={d.margin < 0 ? theme.color.red : theme.color.green} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Cost by category for a selected voyage */}
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: theme.color.slate,
            }}
          >
            Cost breakdown
          </div>
          <Pill
            value={activeId || ""}
            onChange={(e) => setBreakdownId(e.target.value)}
            options={rows.map((r) => ({ value: r.voyageId, label: r.label }))}
          />
        </div>
        {breakdown.length === 0 ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slateFaint }}>
            No costs logged for this voyage.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(120, breakdown.length * 48)}>
            <BarChart data={breakdown} layout="vertical" margin={{ left: 8, right: 16 }}>
              <XAxis
                type="number"
                tick={{ fontFamily: theme.font.mono, fontSize: 10, fill: theme.color.slate }}
                tickFormatter={(v) => `₹${fmtPaise(v * 100)}`}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={150}
                tick={{ fontFamily: theme.font.mono, fontSize: 10, fill: theme.color.inkSoft }}
              />
              <Tooltip
                cursor={{ fill: theme.color.surfaceMuted }}
                formatter={(v) => [`₹${fmtPaise(v * 100)}`, "Cost"]}
                contentStyle={{
                  fontFamily: theme.font.mono,
                  fontSize: 12,
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${theme.color.border}`,
                }}
              />
              <Bar dataKey="amount" fill={theme.color.amber} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
