import { theme, statusTone } from "../../theme";

// StatusBadge — coloured dot + label, tinted by container status.
// `size="sm"` for inline use in the sibling strip; default for the hero.
export default function StatusBadge({ status, label, size = "md", style }) {
  const tone = statusTone(status);
  const text = label ?? status ?? "EMPTY";
  const dot = size === "sm" ? 6 : 8;
  const font = size === "sm" ? 9 : 11;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: tone.fill,
        color: tone.label,
        borderRadius: theme.radius.pill,
        padding: size === "sm" ? "3px 9px" : "5px 11px",
        fontFamily: theme.font.mono,
        fontSize: font,
        fontWeight: 600,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      <span
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: tone.dot,
          flexShrink: 0,
        }}
      />
      {text}
    </span>
  );
}
