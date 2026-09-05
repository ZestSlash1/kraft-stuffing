import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Link as LinkIcon, Plus, Star, Trash2, SlidersHorizontal, Image as ImageIcon, Stamp, ChevronDown } from "lucide-react";
import gsap from "gsap";
import { theme } from "../../theme";
import { mailApi, uploadSignatureImage } from "../../lib/mailApi";
import ConfirmDialog from "../../components/ConfirmDialog";
import { ConnGroup, CONN_CODE_LABELS, MS_OAUTH_STATE_KEY } from "./ConnectView";

const STATUS_TONE = {
  active: { label: "Active", color: theme.color.green },
  error: { label: "Sign-in failed", color: theme.color.red },
  disabled: { label: "Disabled", color: theme.color.slate },
};

// Kick off (or re-run) the Microsoft consent redirect. Reused by ConnectView's first
// connect and here for "Reconnect" — oauth-microsoft.js upserts by email address, so
// reconnecting the same mailbox just refreshes its tokens in place.
async function connectMicrosoft(mailApi) {
  const { url, state } = await mailApi.oauthMicrosoftStart();
  sessionStorage.setItem(MS_OAUTH_STATE_KEY, state);
  window.location.href = url;
}

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
                    {a.incoming_protocol === "pop3" && (
                      <span style={{ marginLeft: 8, fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.1em", color: theme.color.slate, textTransform: "uppercase", border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.sm, padding: "1px 5px" }}>
                        POP3
                      </span>
                    )}
                    {a.auth_type === "oauth2" && (
                      <span style={{ marginLeft: 8, fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.1em", color: theme.color.slate, textTransform: "uppercase", border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.sm, padding: "1px 5px" }}>
                        Outlook
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
                <>
                  <AdvancedSettings key={a.id} accountId={a.id} onSaved={onChanged} />
                  {/* POP3 has no server folders/persistent flags — nothing for trash/junk
                      mapping or filter rules to operate on. */}
                  {a.incoming_protocol !== "pop3" && <FolderRulesSettings key={`fr-${a.id}`} accountId={a.id} />}
                </>
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

// Which security modes are valid for a given incoming protocol — the POP3 client here
// has no STARTTLS support, so it's SSL/TLS or plaintext only.
const incomingSecurityOptions = (protocol) => (protocol === "pop3" ? ["ssl", "none"] : ["ssl", "starttls", "none"]);

// Per-account connection editor. Password accounts get the full IMAP/POP3 + SMTP
// host/port/security editor (save re-runs the server test-connect and surfaces the
// specific failure side). OAuth2 (Outlook) accounts have fixed, non-editable servers —
// this just offers a "Reconnect with Microsoft" for when the stored refresh token has
// been revoked (account status flips to "error").
function AdvancedSettings({ accountId, onSaved }) {
  const [conn, setConn] = useState(null);
  const [authType, setAuthType] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    mailApi.getAccountSettings(accountId).then((s) => {
      if (!alive) return;
      setAuthType(s.auth_type || "password");
      setConn({
        incoming_protocol: s.incoming_protocol || "imap",
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

  const setIncomingProtocol = (p) => {
    setConn((c) => ({
      ...c,
      incoming_protocol: p,
      imap_security: p === "pop3" && c.imap_security === "starttls" ? "ssl" : c.imap_security,
    }));
  };

  const save = async () => {
    setError("");
    setSaved(false);
    if (!conn.imap_host || !conn.smtp_host) {
      setError("Enter both the incoming and outgoing hosts.");
      return;
    }
    setSaving(true);
    try {
      await mailApi.updateAccountSettings(accountId, {
        incoming_protocol: conn.incoming_protocol,
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

  if (authType === "oauth2") {
    return (
      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, lineHeight: 1.6 }}>
          Signed in with Microsoft — {conn.imap_host}:{conn.imap_port} / {conn.smtp_host}:{conn.smtp_port}
          (fixed, not editable). If sign-in has expired or been revoked, reconnect below.
        </div>
        <button
          onClick={() => connectMicrosoft(mailApi).catch((e) => setError(CONN_CODE_LABELS[e.message] || e.message))}
          style={{
            alignSelf: "flex-start", border: "none", borderRadius: theme.radius.sm,
            background: "#2564cf", color: "#ffffff", fontFamily: theme.font.condensed,
            fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", padding: "9px 18px", cursor: "pointer",
          }}
        >
          Reconnect with Microsoft
        </button>
        {error && <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red }}>{error}</div>}
      </div>
    );
  }

  const isPop3 = conn.incoming_protocol === "pop3";

  return (
    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase" }}>Incoming</span>
        <div style={{ display: "flex", gap: 6 }}>
          {["imap", "pop3"].map((p) => (
            <button key={p} onClick={() => setIncomingProtocol(p)} style={{
              border: `1px solid ${conn.incoming_protocol === p ? theme.color.amber : theme.color.border}`,
              background: conn.incoming_protocol === p ? theme.color.amberSoft : "none",
              borderRadius: theme.radius.sm, color: conn.incoming_protocol === p ? theme.color.amberText : theme.color.inkSoft,
              fontFamily: theme.font.mono, fontSize: 12, fontWeight: 600, textTransform: "uppercase", padding: "6px 14px", cursor: "pointer",
            }}>
              {p}
            </button>
          ))}
        </div>
      </div>
      {isPop3 && (
        <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, lineHeight: 1.5 }}>
          Switching to POP3 disables Move, Archive, Junk (with filter rules), and folder mapping for this account.
        </div>
      )}
      <ConnGroup title={`Incoming (${isPop3 ? "POP3" : "IMAP"})`} prefix="imap" conn={conn} setConn={setConn} securityOptions={incomingSecurityOptions(conn.incoming_protocol)} />
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

// Trash/Junk folder mapping override + the standing junk filter-rules list. Folder
// mapping is auto-detected from IMAP special-use flags; these dropdowns let the user
// correct it when a server exposes none. The rules list keeps auto-junk rules visible
// and removable (removing one un-junks that sender for future mail).
function FolderRulesSettings({ accountId }) {
  const [folders, setFolders] = useState(null);
  const [settings, setSettings] = useState(null);
  const [rules, setRules] = useState(null);
  const [savingMap, setSavingMap] = useState(false);
  const [error, setError] = useState("");

  const loadRules = () =>
    mailApi.filterRules(accountId).then((r) => setRules(r.rules || [])).catch(() => setRules([]));

  useEffect(() => {
    let alive = true;
    Promise.all([
      mailApi.folders(accountId).then((r) => r.folders || []).catch(() => []),
      mailApi.getAccountSettings(accountId).catch(() => null),
    ]).then(([f, s]) => {
      if (!alive) return;
      setFolders(f);
      setSettings(s);
    });
    loadRules();
    return () => { alive = false; };
  }, [accountId]);

  const detected = (use) => folders?.find((f) => f.special_use === use)?.path || "";
  const currentTrash = settings?.trash_folder_path ?? detected("trash");
  const currentJunk = settings?.junk_folder_path ?? detected("junk");

  const saveMapping = async (patch) => {
    setSavingMap(true);
    setError("");
    try {
      await mailApi.saveAccountSettings(accountId, patch);
      setSettings((s) => ({ ...(s || {}), ...patch }));
    } catch (e) {
      setError(e.message || "Could not save folder mapping");
    } finally {
      setSavingMap(false);
    }
  };

  const removeRule = async (id) => {
    setRules((rs) => (rs || []).filter((r) => r.id !== id));
    try {
      await mailApi.deleteFilterRule(accountId, id);
    } catch {
      loadRules(); // revert to server truth on failure
    }
  };

  const lbl = { fontFamily: theme.font.mono, fontSize: 10, letterSpacing: "0.16em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 6 };
  const sel = {
    width: "100%", background: theme.color.surface, border: `1px solid ${theme.color.borderStrong}`,
    borderRadius: theme.radius.sm, color: theme.color.ink, fontFamily: theme.font.mono, fontSize: 12,
    padding: "8px 10px", cursor: savingMap ? "wait" : "pointer",
  };

  return (
    <div style={{ marginTop: 14, borderTop: `1px solid ${theme.color.border}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={lbl}>Folder mapping</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginBottom: 4 }}>Trash</div>
            <select value={currentTrash} disabled={!folders || savingMap} onChange={(e) => saveMapping({ trash_folder_path: e.target.value })} style={sel}>
              <option value="">Auto-detect</option>
              {(folders || []).map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, marginBottom: 4 }}>Junk</div>
            <select value={currentJunk} disabled={!folders || savingMap} onChange={(e) => saveMapping({ junk_folder_path: e.target.value })} style={sel}>
              <option value="">Auto-detect</option>
              {(folders || []).map((f) => <option key={f.path} value={f.path}>{f.name}</option>)}
            </select>
          </div>
        </div>
        {error && <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.red, marginTop: 6 }}>{error}</div>}
      </div>

      <div>
        <div style={lbl}>Junk filter rules</div>
        {rules === null && <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>Loading…</div>}
        {rules && rules.length === 0 && (
          <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
            No rules yet. Marking a sender as junk adds one here.
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(rules || []).map((r) => (
            <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, padding: "7px 10px" }}>
              <span style={{ flex: 1, minWidth: 0, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <span style={{ color: theme.color.slate }}>{r.match_type === "sender_domain" ? "domain" : "from"} →</span> {r.match_value}
              </span>
              <button onClick={() => removeRule(r.id)} title="Remove rule (un-junk this sender)"
                style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.sm, color: theme.color.red, fontFamily: theme.font.mono, fontSize: 10, padding: "4px 8px", cursor: "pointer", flexShrink: 0 }}>
                <Trash2 size={11} /> Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// The house signature block — inline styles only (email-safe), placed on white.
// The logo is inserted by the user via the image button, positioned wherever their
// cursor is (typically between the name and company line).
const KRAFT_SIGNATURE_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">Best Regards,<br><b>Shahzeb Tanweer</b><br><br><b>KRAFT SHIPPING AND LOGISTICS PVT LTD</b><br>15 Lu Shun Sarani 3rd Floor<br>Kolkata &#8211; 700073<br>West Bengal, India<br><br>Cell No: +91 9051055017<br>Email id: <a href="mailto:shahzeb@kraftshipping.com">shahzeb@kraftshipping.com</a>, <a href="mailto:shahzeb@shafrina.com">shahzeb@shafrina.com</a><br><a href="https://www.kraftshipping.com">www.kraftshipping.com</a></div>`;

const SHAFRINA_SIGNATURE_HTML = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5;">Best Regards,<br><b>Shahzeb Tanweer</b><br><br><b>SHAFRINA IMPEX LLP</b><br>15 Lu Shun Sarani 3rd Floor<br>Kolkata &#8211; 700073<br>West Bengal, India<br><br>Cell No: +91 9051055017<br>Email id: <a href="mailto:shahzeb@shafrina.com">shahzeb@shafrina.com</a><br><a href="https://www.shafrina.com">www.shafrina.com</a></div>`;

// Built-in, non-deletable templates — always shown first in the picker.
const BUILTIN_SIGNATURE_TEMPLATES = [
  { id: "kraft", name: "Kraft template", html: KRAFT_SIGNATURE_HTML, builtin: true },
  { id: "shafrina", name: "Shafrina template", html: SHAFRINA_SIGNATURE_HTML, builtin: true },
];

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

  const insertTemplate = (html) => {
    restoreCaret();
    document.execCommand("insertHTML", false, html + "<br>");
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
        {/* Signature template picker — built-in Kraft/Shafrina letterheads, plus any
            custom ones saved from the current editor content. */}
        <SignatureTemplatesMenu
          accountId={accountId}
          disabled={loading}
          onPick={(html) => insertTemplate(html)}
          getCurrentHtml={() => ref.current?.innerHTML || ""}
          onBeforeOpen={rememberCaret}
        />
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

// Signature template picker: built-in Kraft/Shafrina letterheads (always first,
// non-deletable) + any custom templates saved from the current editor content
// (kind: 'signature' — separate from compose's saved templates, see 0026).
function SignatureTemplatesMenu({ accountId, disabled, onPick, getCurrentHtml, onBeforeOpen }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    mailApi.templates(accountId, "signature").then((r) => alive && setCustom(r.templates || [])).catch(() => alive && setCustom([]));
    return () => { alive = false; };
  }, [open, accountId]);

  useEffect(() => {
    if (open && menuRef.current) {
      gsap.fromTo(menuRef.current, { opacity: 0, y: -6, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.18, ease: "power2.out" });
    }
  }, [open]);

  const toggle = () => {
    if (!open) onBeforeOpen?.();
    setOpen((v) => !v);
  };

  const pick = (html) => {
    onPick(html);
    setOpen(false);
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { template } = await mailApi.createTemplate({ account_id: accountId, name: name.trim(), body_html: getCurrentHtml(), kind: "signature" });
      setCustom((c) => [template, ...(c || [])]);
      setName("");
    } catch {
      /* best-effort */
    } finally {
      setSaving(false);
    }
  };

  const remove = (id) => {
    setCustom((c) => c.filter((t) => t.id !== id));
    mailApi.deleteTemplate(id).catch(() => {});
  };

  const itemStyle = {
    display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left",
    background: "none", border: "none", borderRadius: theme.radius.sm, padding: "7px 8px",
    cursor: "pointer", fontFamily: theme.font.mono, fontSize: 12, color: theme.color.ink,
  };

  return (
    <div style={{ position: "relative" }}>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={toggle}
        disabled={disabled}
        title="Insert or manage signature templates"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", width: "auto", height: 32,
          background: theme.color.surface, border: `1px solid ${theme.color.borderStrong}`, borderRadius: theme.radius.sm,
          color: theme.color.inkSoft, padding: "0 10px", gap: 6, fontFamily: theme.font.mono, fontSize: 11, cursor: "pointer",
        }}
      >
        <Stamp size={15} /> Templates <ChevronDown size={12} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            ref={menuRef}
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 41, width: 260,
              background: theme.color.surface, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.input,
              boxShadow: theme.shadow.raised, padding: 10,
            }}
          >
            <div style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase", marginBottom: 6 }}>
              Built-in
            </div>
            {BUILTIN_SIGNATURE_TEMPLATES.map((t) => (
              <button key={t.id} onClick={() => pick(t.html)} style={itemStyle}>
                <Stamp size={13} color={theme.color.slate} />
                <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
              </button>
            ))}

            <div style={{ fontFamily: theme.font.mono, fontSize: 9, letterSpacing: "0.14em", color: theme.color.slate, textTransform: "uppercase", margin: "10px 0 6px" }}>
              Custom
            </div>
            {custom === null && <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, padding: "4px 8px" }}>Loading…</div>}
            {custom && custom.length === 0 && <div style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate, padding: "4px 8px" }}>None yet.</div>}
            {(custom || []).map((t) => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button onClick={() => pick(t.body_html)} style={{ ...itemStyle, flex: 1 }}>
                  <span style={{ width: 13, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
                </button>
                <button onClick={() => remove(t.id)} title="Delete"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22, flexShrink: 0, background: "none", border: "none", borderRadius: 6, color: theme.color.slateFaint, cursor: "pointer" }}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.color.border}` }}>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Save current as…"
                onKeyDown={(e) => e.key === "Enter" && save()}
                style={{ flex: 1, background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.sm, color: theme.color.ink, fontFamily: theme.font.mono, fontSize: 11, padding: "6px 8px", outline: "none" }}
              />
              <button
                onClick={save}
                disabled={saving || !name.trim()}
                title="Save current signature as a new template"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28,
                  background: name.trim() ? theme.color.amberSoft : "none", border: "none", borderRadius: theme.radius.sm,
                  color: name.trim() ? theme.color.amberText : theme.color.slateFaint, cursor: name.trim() ? "pointer" : "default",
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
