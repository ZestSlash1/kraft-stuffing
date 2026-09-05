import { useState } from "react";
import { AlertTriangle, Check, CloudOff, Loader } from "lucide-react";
import { theme } from "../../theme";
import { C, F, glass } from "../../ui/theme";

// Shared chrome for the IGM module. These are thin wrappers over the portal's
// existing token set — the module deliberately reuses the Loadex glass/section
// language used by Stuffing Log and the Documentary Suite rather than inventing
// a second visual system.

export const mono = (size = 12, color = theme.color.ink) => ({
  fontFamily: F.mono,
  fontSize: size,
  color,
});

export const capsLabel = {
  fontFamily: F.mono,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: theme.color.slate,
};

export const headline = (size = 24) => ({
  fontFamily: F.head,
  fontWeight: 800,
  fontSize: size,
  letterSpacing: "0.02em",
  color: theme.color.ink,
});

export const primaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: theme.color.amber,
  border: "none",
  color: "#fff",
  fontFamily: F.head,
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "9px 16px",
  borderRadius: theme.radius.sm,
  cursor: "pointer",
};

export const secondaryBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.hair}`,
  color: theme.color.ink,
  fontFamily: F.head,
  fontWeight: 700,
  fontSize: 13.5,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "8px 14px",
  borderRadius: theme.radius.sm,
  cursor: "pointer",
};

export const iconBtn = {
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${C.hair}`,
  color: theme.color.inkSoft,
  borderRadius: theme.radius.sm,
  padding: 6,
  cursor: "pointer",
  display: "inline-flex",
};

// A titled glass section with an id anchor — the BL entry view scrolls to these.
export function Section({ id, title, subtitle, right, children, state }) {
  return (
    <section
      id={id}
      style={{
        ...glass(theme.radius.card),
        padding: 16,
        marginBottom: 14,
        scrollMarginTop: 84, // clears the sticky section rail
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {state && <SectionDot state={state} />}
            <span
              style={{
                fontFamily: F.head,
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: theme.color.ink,
              }}
            >
              {title}
            </span>
          </div>
          {subtitle && (
            <div style={{ ...mono(11, theme.color.slate), marginTop: 4 }}>{subtitle}</div>
          )}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

const STATE_COLOR = {
  ok: C.optimized,
  partial: C.warning,
  empty: C.inkFaint,
};

export function SectionDot({ state, size = 7 }) {
  return (
    <span
      title={state}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: STATE_COLOR[state] || C.inkFaint,
        flexShrink: 0,
        display: "inline-block",
      }}
    />
  );
}

// Label + control + validation message. `invalid` is a { ok, reason } result from
// data/igmHelpers so validators and fields can't drift apart.
export function Field({ label, hint, check, required, children, span }) {
  const bad = check && check.ok === false;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: span }}>
      <span style={capsLabel}>
        {label}
        {required && <span style={{ color: theme.color.amber }}> *</span>}
      </span>
      {children}
      {(bad || hint) && (
        <span style={mono(10, bad ? theme.color.red : theme.color.slate)}>
          {bad ? check.reason : hint}
        </span>
      )}
    </div>
  );
}

// Plain text input honouring the same chrome as components/ui/Input, but usable
// inline inside grid cells (no wrapper column, no label slot).
export function TextInput({ invalid = false, style, ...rest }) {
  const [focused, setFocused] = useState(false);
  const borderColor = invalid
    ? theme.color.red
    : focused
    ? theme.color.amber
    : theme.color.borderStrong;
  return (
    <input
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
        width: "100%",
        boxSizing: "border-box",
        background: rest.disabled ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${borderColor}`,
        boxShadow: focused ? `0 0 0 3px ${theme.color.amber}22` : "none",
        color: theme.color.ink,
        borderRadius: theme.radius.input,
        padding: "9px 11px",
        fontFamily: F.mono,
        fontSize: 12.5,
        outline: "none",
        transition: "border-color .12s ease, box-shadow .12s ease",
        ...style,
      }}
    />
  );
}

export function TextArea({ style, ...rest }) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...rest}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        boxSizing: "border-box",
        minHeight: 96,
        resize: "vertical",
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${focused ? theme.color.amber : theme.color.borderStrong}`,
        boxShadow: focused ? `0 0 0 3px ${theme.color.amber}22` : "none",
        color: theme.color.ink,
        borderRadius: theme.radius.input,
        padding: "10px 12px",
        fontFamily: F.mono,
        fontSize: 12.5,
        lineHeight: 1.6,
        outline: "none",
        ...style,
      }}
    />
  );
}

// Native select in the module's field chrome (square, grid-friendly — Pill is the
// rounded filter-bar variant and stays reserved for that).
export function SelectInput({ options = [], style, allowBlank = false, ...rest }) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <select
      {...rest}
      style={{
        width: "100%",
        boxSizing: "border-box",
        appearance: "none",
        WebkitAppearance: "none",
        background: "rgba(255,255,255,0.05)",
        border: `1px solid ${theme.color.borderStrong}`,
        color: theme.color.ink,
        borderRadius: theme.radius.input,
        padding: "9px 11px",
        fontFamily: F.mono,
        fontSize: 12.5,
        outline: "none",
        cursor: "pointer",
        ...style,
      }}
    >
      {allowBlank && <option value="">—</option>}
      {opts.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckField({ label, checked, onChange, disabled }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "default" : "pointer",
        ...mono(12, theme.color.inkSoft),
        alignSelf: "end",
        minHeight: 38,
      }}
    >
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: theme.color.amber, width: 15, height: 15 }}
      />
      {label}
    </label>
  );
}

// Autosave status — the module has no Save button, so this is the only save
// signal the user gets. It reports exactly what useAutosave knows.
export function SaveState({ status }) {
  const map = {
    saved: { Icon: Check, text: "Saved", color: C.optimized },
    unsaved: { Icon: Loader, text: "Unsaved changes", color: C.warning },
    saving: { Icon: Loader, text: "Saving…", color: C.minor },
    error: { Icon: AlertTriangle, text: "Save failed — retrying on next edit", color: C.critical },
  };
  const { Icon, text, color } = map[status] || map.saved;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...mono(11, color) }}>
      <Icon size={12} /> {text}
    </span>
  );
}

export function OfflineNote({ online }) {
  if (online) return null;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, ...mono(10.5, C.warning) }}>
      <CloudOff size={12} /> Offline — edits are queued locally
    </span>
  );
}

export function EmptyState({ children }) {
  return (
    <div
      style={{
        border: `1px dashed ${C.hair}`,
        borderRadius: theme.radius.sm,
        padding: "18px 16px",
        textAlign: "center",
        ...mono(11.5, theme.color.slate),
      }}
    >
      {children}
    </div>
  );
}

export const gridCols = (isMobile, desktop = 4) => ({
  display: "grid",
  gridTemplateColumns: isMobile ? "1fr" : `repeat(${desktop}, minmax(0, 1fr))`,
  gap: 12,
});
