import { theme } from "../../theme";
import { CATEGORIES } from "../../views/expenses/expenseHelpers";

export const PERIODS = [
  { id: "this-month", label: "This Month" },
  { id: "last-month", label: "Last Month" },
  { id: "all", label: "All Time" },
];

// A single ghost chip — amber border + amber text when active, hairline otherwise.
function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: "0 0 auto",
        background: active ? theme.color.amberSoft : theme.color.surface,
        border: `1px solid ${active ? theme.color.amber : theme.color.border}`,
        color: active ? theme.color.amberText : theme.color.inkSoft,
        borderRadius: theme.radius.pill,
        padding: "7px 14px",
        minHeight: 36,
        fontFamily: theme.font.mono,
        fontSize: 11,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

// ExpenseFilters — a horizontal, scrollable strip: period chips, then a divider,
// then an "All" + per-category chip set.
export default function ExpenseFilters({
  period,
  onPeriod,
  category,
  onCategory,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 4,
      }}
    >
      {PERIODS.map((p) => (
        <Chip
          key={p.id}
          label={p.label}
          active={period === p.id}
          onClick={() => onPeriod(p.id)}
        />
      ))}

      <span
        style={{
          flex: "0 0 auto",
          width: 1,
          alignSelf: "stretch",
          background: theme.color.border,
          margin: "0 4px",
        }}
      />

      <Chip label="All" active={!category} onClick={() => onCategory(null)} />
      {CATEGORIES.map((c) => (
        <Chip
          key={c.name}
          label={c.name}
          active={category === c.name}
          onClick={() => onCategory(c.name)}
        />
      ))}
    </div>
  );
}
