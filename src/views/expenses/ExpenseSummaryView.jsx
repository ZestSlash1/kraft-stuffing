import { theme } from "../../theme";
import { fmtPaise } from "./expenseHelpers";
import CategoryBadge from "../../components/expenses/CategoryBadge";

// ExpenseSummaryView — period total up top, then a pure-CSS category breakdown
// (bar width = share of the largest category). No charting lib; the inline bars
// keep the clean light aesthetic consistent with the rest of the app.
export default function ExpenseSummaryView({ expenses = [] }) {
  const expenseRows = expenses.filter((e) => e.type === "expense");
  const incomeRows = expenses.filter((e) => e.type === "income");
  const totalExpense = expenseRows.reduce((a, e) => a + Number(e.amount), 0);
  const totalIncome = incomeRows.reduce((a, e) => a + Number(e.amount), 0);

  // Aggregate by category.
  const byCat = {};
  for (const e of expenses) {
    if (!byCat[e.category]) byCat[e.category] = { total: 0, type: e.type };
    byCat[e.category].total += Number(e.amount);
  }
  const rows = Object.entries(byCat)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total);
  const max = rows.reduce((a, r) => Math.max(a, r.total), 0) || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* Period total */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 32,
          alignItems: "flex-end",
        }}
      >
        <div>
          <div
            style={{
              fontFamily: theme.font.mono,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: theme.color.slate,
            }}
          >
            Net Expense
          </div>
          <div
            style={{
              fontFamily: theme.font.condensed,
              fontWeight: 800,
              fontSize: 48,
              lineHeight: 1,
              color: theme.color.ink,
            }}
          >
            <span style={{ color: theme.color.slate, fontWeight: 400 }}>₹</span>
            {fmtPaise(totalExpense)}
          </div>
        </div>
        <div style={{ paddingBottom: 6 }}>
          <div
            style={{
              fontFamily: theme.font.mono,
              fontSize: 9,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: theme.color.slate,
            }}
          >
            Income
          </div>
          <div
            style={{
              fontFamily: theme.font.condensed,
              fontWeight: 700,
              fontSize: 26,
              lineHeight: 1,
              color: theme.color.green,
            }}
          >
            <span style={{ color: theme.color.slate, fontWeight: 400 }}>₹</span>
            {fmtPaise(totalIncome)}
          </div>
        </div>
      </div>

      {/* Category breakdown */}
      <div>
        <div
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: theme.color.slate,
            marginBottom: 16,
          }}
        >
          By category
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {rows.map((r) => {
            const income = r.type === "income";
            const barColor = income ? theme.color.green : theme.color.amber;
            return (
              <div key={r.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <CategoryBadge category={r.name} type={r.type} size="sm" />
                  <span
                    style={{
                      fontFamily: theme.font.mono,
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.color.ink,
                    }}
                  >
                    <span style={{ color: theme.color.slate, fontWeight: 400 }}>₹</span>
                    {fmtPaise(r.total)}
                  </span>
                </div>
                <div
                  style={{
                    height: 4,
                    background: theme.color.surfaceMuted,
                    borderRadius: theme.radius.pill,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${(r.total / max) * 100}%`,
                      background: barColor,
                      borderRadius: theme.radius.pill,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
