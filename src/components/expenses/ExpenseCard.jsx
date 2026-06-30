import { theme } from "../../theme";
import { fmtDay, fmtPaise } from "../../views/expenses/expenseHelpers";
import CategoryBadge from "./CategoryBadge";

// ExpenseCard — a single ledger row. Left: date (mono, slate). Centre: description
// (condensed) + category badge. Right: signed amount — green for income, red for
// expense. Hairline divider below; active row gets an amber left rail.
export default function ExpenseCard({ expense, active = false, onClick }) {
  const income = expense.type === "income";
  const amountColor = income ? theme.color.green : theme.color.red;

  return (
    <div
      onClick={() => onClick?.(expense)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "12px 16px",
        borderBottom: `1px solid ${theme.color.border}`,
        borderLeft: `3px solid ${active ? theme.color.amber : "transparent"}`,
        background: active ? `${theme.color.amber}0a` : "transparent",
        cursor: onClick ? "pointer" : "default",
        minHeight: 44,
      }}
    >
      <span
        style={{
          fontFamily: theme.font.mono,
          fontSize: 11,
          color: theme.color.slate,
          flex: "0 0 42px",
        }}
      >
        {fmtDay(expense.expenseDate)}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: theme.font.condensed,
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: "0.01em",
            color: theme.color.ink,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {expense.description}
        </div>
        <div style={{ marginTop: 5 }}>
          <CategoryBadge category={expense.category} type={expense.type} size="sm" />
        </div>
      </div>

      <span
        style={{
          fontFamily: theme.font.mono,
          fontSize: 15,
          fontWeight: 600,
          color: amountColor,
          whiteSpace: "nowrap",
        }}
      >
        <span style={{ color: theme.color.slate, fontWeight: 400 }}>
          {income ? "+₹" : "−₹"}
        </span>
        {fmtPaise(expense.amount)}
      </span>
    </div>
  );
}
