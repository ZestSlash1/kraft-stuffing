import { forwardRef, useState } from "react";
import { theme } from "../../theme";

// Input — light text field, 12px radius. Optional leading `label` (mono caps)
// rendered above the field. Amber focus ring. Forwards ref + native props.
const Input = forwardRef(function Input(
  { label, style, invalid = false, hint, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? theme.color.red
    : focused
    ? theme.color.amber
    : theme.color.borderStrong;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {label && (
        <span
          style={{
            fontFamily: theme.font.mono,
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: theme.color.slate,
          }}
        >
          {label}
        </span>
      )}
      <input
        ref={ref}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={{
          background: rest.disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${borderColor}`,
          boxShadow: focused ? `0 0 0 3px ${theme.color.amber}22` : "none",
          color: theme.color.ink,
          borderRadius: theme.radius.input,
          padding: "9px 12px",
          fontFamily: theme.font.mono,
          fontSize: 13,
          outline: "none",
          transition: "border-color .12s ease, box-shadow .12s ease",
          ...style,
        }}
        {...rest}
      />
      {hint && (
        <span
          style={{
            fontFamily: theme.font.mono,
            fontSize: 10,
            color: invalid ? theme.color.red : theme.color.slate,
            maxWidth: 220,
          }}
        >
          {hint}
        </span>
      )}
    </div>
  );
});

export default Input;
