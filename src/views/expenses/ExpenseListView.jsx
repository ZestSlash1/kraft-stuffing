import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { theme } from "../../theme";
import ExpenseCard from "../../components/expenses/ExpenseCard";
import { fmtDateHeader } from "./expenseHelpers";

// ExpenseListView — expenses grouped under sticky date headers, newest first.
// Rows stagger in on mount (mirrors ManifestTable). Empty state when nothing
// matches the active filters.
export default function ExpenseListView({ expenses = [], selectedId, onSelect }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (
      !listRef.current ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const rows = listRef.current.querySelectorAll("[data-expense-row]");
    gsap.from(rows, { y: 8, opacity: 0, stagger: 0.04, duration: 0.35, ease: "power2.out" });
  }, [expenses]);

  if (expenses.length === 0) {
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
          NO EXPENSES LOGGED
        </div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 12,
            letterSpacing: "0.06em",
            color: theme.color.slateFaint,
          }}
        >
          Adjust the filters or log a new entry above.
        </div>
      </div>
    );
  }

  // Group by date, preserving the newest-first order.
  const sorted = [...expenses].sort((a, b) =>
    a.expenseDate < b.expenseDate ? 1 : -1
  );
  const groups = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.expenseDate) last.items.push(e);
    else groups.push({ date: e.expenseDate, items: [e] });
  }

  return (
    <div
      ref={listRef}
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadow.card,
        overflow: "hidden",
      }}
    >
      {groups.map((g) => (
        <div key={g.date}>
          <div
            style={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              background: theme.color.surfaceMuted,
              borderBottom: `1px solid ${theme.color.border}`,
              padding: "7px 16px",
              fontFamily: theme.font.mono,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: theme.color.slate,
            }}
          >
            {fmtDateHeader(g.date)}
          </div>
          {g.items.map((e) => (
            <div key={e.id} data-expense-row>
              <ExpenseCard
                expense={e}
                active={e.id === selectedId}
                onClick={onSelect}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
