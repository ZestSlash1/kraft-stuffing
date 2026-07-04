import { theme } from "../../theme";
import { glass } from "../../ui/theme";

// Card — Loadex glass panel: 20px radius, hairline border, deep soft shadow.
// Pass `inset` for the muted well variant, or `raised` for higher elevation.
export default function Card({ inset = false, raised = false, style, children, ...rest }) {
  return (
    <div
      style={{
        ...glass(theme.radius.card),
        ...(inset && { background: "rgba(255,255,255,0.03)", boxShadow: "none" }),
        ...(raised && { boxShadow: theme.shadow.raised }),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
