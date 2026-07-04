import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { theme } from "../../theme";

// Pill — a rounded dropdown styled as a select. Native <select> under the hood
// (keeps keyboard + mobile behaviour) with a custom chevron and pill chrome.
export default function Pill({ value, onChange, options = [], style, disabled = false, ...rest }) {
  const [focused, setFocused] = useState(false);
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));

  return (
    <div
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
      }}
    >
      <select
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          background: disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${focused ? theme.color.amber : theme.color.borderStrong}`,
          boxShadow: focused ? `0 0 0 3px ${theme.color.amber}22` : theme.shadow.pill,
          color: theme.color.ink,
          borderRadius: theme.radius.pill,
          padding: "8px 34px 8px 14px",
          fontFamily: theme.font.mono,
          fontSize: 12,
          cursor: disabled ? "default" : "pointer",
          outline: "none",
          transition: "border-color .12s ease, box-shadow .12s ease",
          ...style,
        }}
        {...rest}
      >
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={14}
        color={theme.color.slate}
        style={{ position: "absolute", right: 12, pointerEvents: "none" }}
      />
    </div>
  );
}
