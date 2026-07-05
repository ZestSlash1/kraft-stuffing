import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, Plus, Star, Trash2, SlidersHorizontal, Image as ImageIcon, Stamp } from "lucide-react";
import { theme } from "../../theme";
import { mailApi, uploadSignatureImage } from "../../lib/mailApi";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ConnGroup, CONN_CODE_LABELS } from "./ConnectView";

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
  const [expandedId, setExpandedId] = useState(null);
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
                  onClick={() => setExpandedId((id) => (id === a.id ? null : a.id))}
                  disabled={busy}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "none",
                    border: `1px solid ${expandedId === a.id ? theme.color.amber : theme.color.borderStrong}`,
                    borderRadius: theme.radius.sm,
                    color: theme.color.inkSoft,
                    fontFamily: theme.font.mono,
                    fontSize: 11,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  <SlidersHorizontal size={12} /> Advanced
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

              {expandedId === a.id && (
                <AdvancedSettings key={a.id} accountId={a.id} onSaved={onChanged} />
              )}

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

// Per-account connection editor: IMAP/SMTP host/port/security, prefilled from the
// account's current values. Save re-runs the server test-connect (settings.js) and
// surfaces the specific failure side (imap_failed / smtp_failed / auth_failed).
function AdvancedSettings({ accountId, onSaved }) {
  const [conn, setConn] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    mailApi.getAccountSettings(accountId).then((s) => {
      if (!alive) return;
      setConn({
        imap_host: s.imap_host || "",
        imap_port: s.imap_port || 993,
        imap_security: s.imap_security || "ssl",
        smtp_host: s.smtp_host || "",
        smtp_port: s.smtp_port || 465,
        smtp_security: s.smtp_security || "ssl",
      });
    });
    return () => { alive = false; };
  }, [accountId]);

  const save = async () => {
    setError("");
    setSaved(false);
    if (!conn.imap_host || !conn.smtp_host) {
      setError("Enter both the incoming (IMAP) and outgoing (SMTP) hosts.");
      return;
    }
    setSaving(true);
    try {
      await mailApi.updateAccountSettings(accountId, {
        imap_host: conn.imap_host,
        imap_port: Number(conn.imap_port),
        imap_security: conn.imap_security,
        smtp_host: conn.smtp_host,
        smtp_port: Number(conn.smtp_port),
        smtp_security: conn.smtp_security,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved?.();
    } catch (e) {
      setError(CONN_CODE_LABELS[e.message] || e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!conn) {
    return (
      <div style={{ marginTop: 12, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
        Loading settings…
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <ConnGroup title="Incoming (IMAP)" prefix="imap" conn={conn} setConn={setConn} />
      <ConnGroup title="Outgoing (SMTP)" prefix="smtp" conn={conn} setConn={setConn} />
      {error && (
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red }}>{error}</div>
      )}
      <button
        onClick={save}
        disabled={saving}
        style={{
          alignSelf: "flex-start",
          border: "none",
          borderRadius: theme.radius.sm,
          background: saved ? theme.color.green : theme.color.amber,
          color: theme.color.white,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          padding: "9px 18px",
          cursor: saving ? "wait" : "pointer",
        }}
      >
        {saved ? "Saved & verified" : saving ? "Testing…" : "Test & save"}
      </button>
    </div>
  );
}

// The house signature block — inline styles only (email-safe), placed on white.
// The logo is inserted by the user via the image button, positioned wherever their
// cursor is (typically between the name and company line).
const KRAFT_SIGNATURE_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">Best Regards,<br><b>Shahzeb Tanweer</b><br><br><b>KRAFT SHIPPING AND LOGISTICS PVT LTD</b><br>15 Lu Shun Sarani 3rd Floor<br>Kolkata &#8211; 700073<br>West Bengal, India<br><br>Cell No: +91 9051055017<br>Email id: <a href="mailto:shahzeb@kraftshipping.com">shahzeb@kraftshipping.com</a>, <a href="mailto:shahzeb@shafrina.com">shahzeb@shafrina.com</a><br><a href="https://www.kraftshipping.com">www.kraftshipping.com</a></div>`;

// Per-account signature — a lightweight contenteditable with bold/italic/link, plus
// logo upload (hosted in the public mail-assets bucket) and a live width slider to
// rescale the selected image so it fits perfectly.
function SignatureEditor({ accountId }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [selImg, setSelImg] = useState(null); // currently-clicked <img> in the editor
  const [imgW, setImgW] = useState(180);
  const ref = useRef(null);
  const fileRef = useRef(null);
  const savedRange = useRef(null); // last caret position, so inserts land where expected

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setSelImg(null);
    mailApi
      .getAccountSettings(accountId)
      .then((s) => {
        if (!alive) return;
        if (ref.current) ref.current.innerHTML = s.signature_html || "";
      })
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [accountId]);

  // Remember the caret so toolbar/file-dialog actions insert at the right spot.
  const rememberCaret = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const restoreCaret = () => {
    ref.current?.focus();
    const sel = window.getSelection();
    if (savedRange.current && sel) {
      sel.removeAllRanges();
      sel.addRange(savedRange.current);
    }
  };

  const cmd = (command) => {
    if (command === "createLink") {
      const url = window.prompt("Link URL");
      if (url) document.execCommand("createLink", false, url);
    } else {
      document.execCommand(command, false, null);
    }
    ref.current?.focus();
  };

  const insertTemplate = () => {
    restoreCaret();
    document.execCommand("insertHTML", false, KRAFT_SIGNATURE_HTML + "<br>");
    rememberCaret();
  };

  const onPickImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const url = await uploadSignatureImage(file);
      restoreCaret();
      // width + inline style + height:auto → renders consistently across mail clients.
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${url}" alt="logo" width="180" style="width:180px;height:auto;display:inline-block;" />&nbsp;`
      );
      rememberCaret();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  // Click an image in the editor to select it for resizing.
  const onEditorClick = (e) => {
    if (e.target?.tagName === "IMG") {
      setSelImg(e.target);
      const w = parseInt(e.target.getAttribute("width"), 10) || e.target.offsetWidth || 180;
      setImgW(w);
    } else {
      setSelImg(null);
    }
  };

  const onResize = (w) => {
    setImgW(w);
    if (selImg) {
      selImg.setAttribute("width", String(w));
      selImg.style.width = `${w}px`;
      selImg.style.height = "auto";
    }
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

  const toolBtn = {
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
  };

  return (
    <div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.18em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 8 }}>
        Signature
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {[
          { Icon: Bold, c: "bold" },
          { Icon: Italic, c: "italic" },
          { Icon: LinkIcon, c: "createLink" },
        ].map(({ Icon, c }) => (
          <button key={c} onMouseDown={(e) => { e.preventDefault(); cmd(c); }} style={toolBtn}>
            <Icon size={15} />
          </button>
        ))}
        {/* Insert logo (uploads to the public bucket, then embeds the URL). */}
        <button
          onMouseDown={(e) => { e.preventDefault(); rememberCaret(); }}
          onClick={() => fileRef.current?.click()}
          disabled={uploading || loading}
          title="Insert logo"
          style={{ ...toolBtn, width: "auto", padding: "0 10px", gap: 6, fontFamily: theme.font.mono, fontSize: 11 }}
        >
          <ImageIcon size={15} /> {uploading ? "Uploading…" : "Logo"}
        </button>
        {/* One-click Kraft signature template. */}
        <button
          onMouseDown={(e) => { e.preventDefault(); rememberCaret(); }}
          onClick={insertTemplate}
          disabled={loading}
          title="Insert Kraft signature template"
          style={{ ...toolBtn, width: "auto", padding: "0 10px", gap: 6, fontFamily: theme.font.mono, fontSize: 11 }}
        >
          <Stamp size={15} /> Kraft template
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPickImage} style={{ display: "none" }} />
      </div>

      {/* Resize slider — appears when an image in the editor is selected. */}
      {selImg && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.1em", color: theme.color.slate, textTransform: "uppercase" }}>
            Logo width
          </span>
          <input
            type="range"
            min={40}
            max={480}
            value={imgW}
            onChange={(e) => onResize(Number(e.target.value))}
            style={{ flex: 1, accentColor: theme.color.amber }}
          />
          <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.ink, width: 46, textAlign: "right" }}>
            {imgW}px
          </span>
        </div>
      )}

      <div
        ref={ref}
        contentEditable={!loading}
        suppressContentEditableWarning
        onClick={onEditorClick}
        onKeyUp={rememberCaret}
        onMouseUp={rememberCaret}
        onBlur={rememberCaret}
        style={{
          minHeight: 120,
          background: "#ffffff", // white canvas — matches the recipient's email background
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.input,
          padding: "12px 14px",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          color: "#1a1a1a",
          outline: "none",
          opacity: loading ? 0.5 : 1,
        }}
      />

      {error && (
        <div style={{ marginTop: 8, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red }}>{error}</div>
      )}

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
