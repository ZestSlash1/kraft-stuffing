import { theme } from "../../theme";
import { fmtPaise } from "../../views/expenses/expenseHelpers";

// ExpenseSummaryStrip — borderless stats strip mirroring VoyageView's header strip.
// Cells separated by a hairline left border (first cell has none). Money cells
// prefix ₹ in slate, number in ink.
const Cell = ({ label, value, money = false, first = false }) => (
  <div
    style={{
      padding: "0 22px",
      borderLeft: first ? "none" : `1px solid ${theme.color.border}`,
    }}
  >
    <div
      style={{
        fontFamily: theme.font.mono,
        fontSize: 9,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: theme.color.slate,
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontFamily: theme.font.condensed,
        fontSize: 28,
        fontWeight: 700,
        color: theme.color.ink,
        lineHeight: 1.1,
      }}
    >
      {money && <span style={{ color: theme.color.slate }}>₹</span>}
      {value}
    </div>
  </div>
);

export default function ExpenseSummaryStrip({ expenses = [] }) {
  const expenseRows = expenses.filter((e) => e.type === "expense");
  const total = expenseRows.reduce((a, e) => a + Number(e.amount), 0);
  const largest = expenseRows.reduce((a, e) => Math.max(a, Number(e.amount)), 0);
  const categories = new Set(expenses.map((e) => e.category)).size;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 0" }}>
      <Cell label="Total This Month" value={fmtPaise(total)} money first />
      <Cell label="Largest Expense" value={fmtPaise(largest)} money />
      <Cell label="Categories" value={categories} />
      <Cell label="Transactions" value={expenses.length} />
    </div>
  );
}
