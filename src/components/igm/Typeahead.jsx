import { useEffect, useMemo, useRef, useState } from "react";
import { theme } from "../../theme";
import { C, F, glass } from "../../ui/theme";
import { TextInput } from "./igmChrome";

// Typeahead — free-text field with suggestions, used for Vessel / Voyage / Port.
// A dropdown would be wrong here: the value sets are open (any port in the world
// can appear on a BL) but the common ones should be one keystroke away. The typed
// value is always committed as-is; suggestions only save typing.
//
// options: [string] | [{ value, label, hint }]
// onCommit fires on blur / Enter / suggestion click — that's the autosave trigger,
// so we never write a partial word on every keypress.
export default function Typeahead({
  value,
  options = [],
  onChange,
  onCommit,
  placeholder,
  invalid = false,
  disabled = false,
  maxSuggestions = 8,
}) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef(null);

  // Options may be plain strings, or objects carrying only a value + hint (the
  // port list is { value, hint }) — normalise so the filter never touches an
  // undefined label.
  const opts = useMemo(
    () =>
      options.map((o) =>
        typeof o === "string"
          ? { value: o, label: o, hint: "" }
          : { value: o.value, label: o.label ?? String(o.value ?? ""), hint: o.hint ?? "" }
      ),
    [options]
  );

  const matches = useMemo(() => {
    const q = String(value || "").trim().toLowerCase();
    const pool = q
      ? opts.filter(
          (o) =>
            o.label.toLowerCase().includes(q) ||
            String(o.hint || "").toLowerCase().includes(q)
        )
      : opts;
    return pool.slice(0, maxSuggestions);
  }, [opts, value, maxSuggestions]);

  // Close on any click outside the field + list.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const pick = (opt) => {
    onChange(opt.value);
    setOpen(false);
    onCommit?.(opt.value, opt);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[highlight]) {
        e.preventDefault();
        pick(matches[highlight]);
      } else {
        onCommit?.(value);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <TextInput
        value={value || ""}
        disabled={disabled}
        invalid={invalid}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setOpen(true)}
        // Suggestion clicks fire on mousedown (before blur), so closing here is safe.
        onBlur={() => {
          setOpen(false);
          onCommit?.(value);
        }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 40,
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            maxHeight: 232,
            overflowY: "auto",
            ...glass(theme.radius.sm),
            boxShadow: theme.shadow.raised,
            padding: 4,
          }}
        >
          {matches.map((o, i) => (
            <button
              key={o.value}
              // mousedown, not click: the input's blur would close the list first.
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHighlight(i)}
              style={{
                display: "flex",
                width: "100%",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 10,
                background: i === highlight ? "rgba(232,147,10,0.14)" : "transparent",
                border: "none",
                borderRadius: theme.radius.sm - 2,
                padding: "7px 9px",
                cursor: "pointer",
                textAlign: "left",
                fontFamily: F.mono,
                fontSize: 12,
                color: theme.color.ink,
              }}
            >
              <span>{o.label}</span>
              {o.hint && (
                <span style={{ fontSize: 10, color: C.inkFaint, whiteSpace: "nowrap" }}>
                  {o.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
