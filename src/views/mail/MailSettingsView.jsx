import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, Plus, Star, Trash2 } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";
import ConfirmDialog from "../../components/ConfirmDialog";

const STATUS_TONE = {
  active: { label: "Active", color: theme.color.green },
  error: { label: "Sign-in failed", color: theme.color.red },
  disabled: { label: "Disabled", color: theme.color.slate },
};

// Manage every connected mailbox: default toggle, disconnect, and per-account
// signature. Accounts/limit come from MailShell; onChanged re-loads them after edits.
export default function MailSettingsView({ accounts = [], limit = 4, onChanged, onAddAccount }) {
  const [selectedId, setSelectedId] = useState(
    () => accounts.find((a) => a.is_default)?.id || accounts[0]?.id || null
  );
  const [confirmId, setConfirmId] = useState(null);
  const [busy, setBusy] = useState(false);

  // Keep a valid selection as accounts change (e.g. after disconnect).
  useEffect(() => {
    if (accounts.length === 0) { setSelectedId(null); return; }
    if (!accounts.some((a) => a.id === selectedId)) {
      setSelectedId(accounts.find((a) => a.is_default)?.id || accounts[0].id);
    }
  }, [accounts, selectedId]);

  const setDefault = async (id) => {
    setBusy(true);
    try {
      await mailApi.saveAccountSettings(id, { is_default: true });
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async (id) => {
    setBusy(true);
    try {
      await mailApi.disconnectAccount(id);
      setConfirmId(null);
      await onChanged?.();
    } finally {
      setBusy(false);
    }
  };

  const canAdd = accounts.length < limit;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: "0.02em",
          color: theme.color.ink,
        }}
      >
        MAIL SETTINGS
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, margin: "6px 0 22px" }}>
        {accounts.length === 0
          ? "No mailbox connected yet"
          : `${accounts.length} of ${limit} mailbox${accounts.length === 1 ? "" : "es"} connected`}
      </div>

      {/* Account list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
        {accounts.map((a) => {
          const tone = STATUS_TONE[a.status] || STATUS_TONE.active;
          const selected = a.id === selectedId;
          return (
            <div
              key={a.id}
              style={{
                border: `1px solid ${selected ? theme.color.amber : theme.color.border}`,
                borderRadius: theme.radius.input,
                background: theme.color.surface,
                padding: "12px 14px",
              }}
            >
              <div
                onClick={() => setSelectedId(a.id)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
              >
                <span style={{ width: 11, height: 11, borderRadius: "50%", background: a.color || theme.color.slate, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 15, color: theme.color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.display_name || a.email_address}
                    {a.is_default && (
                      <span style={{ marginLeft: 8, fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.1em", color: theme.color.amberText, textTransform: "uppercase" }}>
                        Default
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {a.email_address}
                  </div>
                </div>
                <span style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: tone.color }} />
                  <span style={{ fontFamily: theme.font.mono, fontSize: 10, color: tone.color }}>{tone.label}</span>
                </span>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button
                  onClick={() => setDefault(a.id)}
                  disabled={a.is_default || busy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: `1px solid ${theme.color.borderStrong}`,
                    borderRadius: theme.radius.sm,
                    color: a.is_default ? theme.color.slateFaint : theme.color.inkSoft,
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    padding: "6px 12px",
                    cursor: a.is_default ? "default" : "pointer",
                  }}
                >
                  <Star size={12} fill={a.is_default ? theme.color.amber : "none"} color={a.is_default ? theme.color.amber : "currentColor"} />
                  {a.is_default ? "Default" : "Make default"}
                </button>
                <button
                  onClick={() => setConfirmId(a.id)}
                  disabled={busy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: `1px solid ${theme.color.borderStrong}`,
                    borderRadius: theme.radius.sm,
                    color: theme.color.red,
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} /> Disconnect
                </button>
              </div>

              {confirmId === a.id && (
                <ConfirmDialog
                  message={`Disconnect ${a.email_address}? Its stored credentials are deleted.`}
                  confirmLabel="Disconnect"
                  onConfirm={() => disconnect(a.id)}
                  onCancel={() => setConfirmId(null)}
                />
              )}
            </div>
          );
        })}
      </div>

      {canAdd ? (
        <button
          onClick={onAddAccount}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: `1px dashed ${theme.color.borderStrong}`,
            borderRadius: theme.radius.input,
            color: theme.color.amberText,
            fontFamily: theme.font.condensed,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "12px 16px",
            cursor: "pointer",
            marginBottom: 28,
          }}
        >
          <Plus size={16} /> Add account
        </button>
      ) : (
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginBottom: 28 }}>
          Account limit reached ({limit}). Disconnect one to add another.
        </div>
      )}

      {selectedId && <SignatureEditor key={selectedId} accountId={selectedId} />}
    </div>
  );
}

// Per-account signature — a lightweight contenteditable with bold/italic/link.
function SignatureEditor({ accountId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    mailApi
      .getAccountSettings(accountId)
      .then((s) => {
        if (!alive) return;
        if (ref.current) ref.current.innerHTML = s.signature_html || "";
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [accountId]);

  const cmd = (command) => {
    if (command === "createLink") {
      const url = window.prompt("Link URL");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(command, false, null);
    }
    ref.current?.focus();
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await mailApi.saveAccountSettings(accountId, { signature_html: ref.current?.innerHTML || "" });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.18em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 8 }}>
        Signature
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {[
          { Icon: Bold, c: "bold" },
          { Icon: Italic, c: "italic" },
          { Icon: LinkIcon, c: "createLink" },
        ].map(({ Icon, c }) => (
          <button
            key={c}
            onMouseDown={(e) => { e.preventDefault(); cmd(c); }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 34,
              height: 32,
              background: theme.color.surface,
              border: `1px solid ${theme.color.borderStrong}`,
              borderRadius: theme.radius.sm,
              color: theme.color.inkSoft,
              cursor: "pointer",
            }}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable={!loading}
        suppressContentEditableWarning
        style={{
          minHeight: 120,
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.input,
          padding: "12px 14px",
          fontFamily: theme.font.body,
          fontSize: 14,
          lineHeight: 1.6,
          color: theme.color.ink,
          outline: "none",
          opacity: loading ? 0.5 : 1,
        }}
      />
      <button
        onClick={save}
        disabled={saving || loading}
        style={{
          marginTop: 16,
          border: "none",
          borderRadius: theme.radius.input,
          background: saved ? theme.color.green : theme.color.amber,
          color: theme.color.white,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 16,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          padding: "11px 22px",
          cursor: saving ? "wait" : "pointer",
        }}
      >
        {saved ? "Saved" : saving ? "Saving…" : "Save signature"}
      </button>
    </div>
  );
}
