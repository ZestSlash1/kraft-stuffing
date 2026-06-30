import { theme } from "../../theme";

// Card — the base light surface: 20px radius, hairline border, soft shadow.
// Pass `inset` for the muted well variant, or `raised` for higher elevation.
export default function Card({ inset = false, raised = false, style, children, ...rest }) {
  return (
    <div
      style={{
        background: inset ? theme.color.surfaceMuted : theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: inset ? "none" : raised ? theme.shadow.raised : theme.shadow.card,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
