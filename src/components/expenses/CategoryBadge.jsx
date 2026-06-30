import { theme } from "../../theme";
import { categoryType } from "../../views/expenses/expenseHelpers";

// CategoryBadge — a quiet inline category chip. Amber tint for expense categories,
// green tint for income. Mirrors StatusBadge's pill chrome but text-only (no dot).
export default function CategoryBadge({ category, type, size = "md", style }) {
  const t = type || categoryType(category);
  const income = t === "income";
  const color = income ? theme.color.green : theme.color.amber;
  const fill = income ? theme.color.greenSoft : theme.color.amberSoft;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: fill,
        color,
        borderRadius: theme.radius.pill,
        padding: size === "sm" ? "2px 8px" : "3px 10px",
        fontFamily: theme.font.mono,
        fontSize: size === "sm" ? 9 : 10,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {category}
    </span>
  );
}
