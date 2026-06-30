import { useState } from "react";
import { supabase } from "../lib/supabase";
import { saveOrgSettings, KRAFT_ORG_ID } from "../lib/db";
import { theme } from "../theme";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import TeamPanel from "./TeamPanel";

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 12,
  color: theme.color.ink,
  padding: "10px 12px",
  fontFamily: theme.font.mono,
  fontSize: 13,
  outline: "none",
};

function Section({ title, children }) {
  return (
    <div style={{ padding: "22px 0", borderBottom: `1px solid ${theme.color.border}` }}>
      <div className="label-xs" style={{ marginBottom: 14, fontSize: 11 }}>{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label className="label-xs" style={{ display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function SaveButton({ onSave, saved }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
      <button
        onClick={onSave}
        style={{ background: theme.color.amber, border: "none", color: theme.color.surface, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "9px 18px", cursor: "pointer" }}
      >
        Save Settings
      </button>
      {saved && <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.green }}>Saved ✓</span>}
    </div>
  );
}

export default function SettingsView({ app }) {
  const { user, profile } = useAuth();
  const { orgSettings, setOrgSettings } = app;
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [title, setTitle] = useState(profile?.title || "");
  const [settings, setSettings] = useState(orgSettings || {});
  const [saved, setSaved] = useState({});

  // Change-password fields (account security).
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const flash = (key) => {
    setSaved((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
  };

  const setS = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value }));

  const saveProfile = async () => {
    await supabase.from("profiles").upsert(
      { id: user.id, org_id: KRAFT_ORG_ID, display_name: displayName, title },
      { onConflict: "id" }
    );
    flash("profile");
    showToast("Profile saved", "success");
  };

  const changePassword = async () => {
    setPwError("");
    if (newPassword.length < 8) return setPwError("Use at least 8 characters.");
    if (newPassword !== confirmPassword) return setPwError("Passwords don't match.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return setPwError(error.message);
    setNewPassword("");
    setConfirmPassword("");
    flash("password");
    showToast("Password updated", "success");
  };

  const persist = async (keys, tag) => {
    const entries = Object.fromEntries(keys.map((k) => [k, settings[k] ?? ""]));
    const { error } = await saveOrgSettings(entries);
    setOrgSettings((cur) => ({ ...cur, ...entries }));
    flash(tag);
    showToast(error ? "Saved locally (offline)" : "Settings saved", error ? "info" : "success");
  };

  const signOut = () => supabase.auth.signOut();

  return (
    <div style={{ minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 18px 50px" }}>
      <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, color: theme.color.ink, marginBottom: 4 }}>
        SETTINGS
      </div>

      <Section title="PROFILE">
        <Row label="Display name">
          <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Row>
        <Row label="Title">
          <input style={input} placeholder="e.g. Operations Manager" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Row>
        <Row label="Email">
          <input style={{ ...input, color: theme.color.slate }} value={user?.email || ""} readOnly />
        </Row>
        <Row label="Role">
          <span style={{ fontFamily: theme.font.mono, fontSize: 11, color: theme.color.amber, border: `1px solid ${theme.color.amber}`, padding: "3px 8px", borderRadius: 3 }}>
            {(profile?.role || "staff").toUpperCase()}
          </span>
        </Row>
        <SaveButton onSave={saveProfile} saved={saved.profile} />
        <button
          onClick={signOut}
          style={{ marginTop: 16, background: "none", border: `1px solid ${theme.color.red}`, color: theme.color.red, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 14, textTransform: "uppercase", padding: "10px 18px", cursor: "pointer", width: "100%" }}
        >
          Sign Out
        </button>
      </Section>

      <Section title="ACCOUNT SECURITY">
        <Row label="New password">
          <input
            type="password"
            autoComplete="new-password"
            style={input}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Row>
        <Row label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            style={input}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </Row>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <button
            onClick={changePassword}
            style={{ background: theme.color.amber, border: "none", color: theme.color.surface, fontFamily: theme.font.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "9px 18px", cursor: "pointer" }}
          >
            Update Password
          </button>
          {saved.password && <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.green }}>Updated ✓</span>}
          {pwError && <span style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red }}>{pwError}</span>}
        </div>
      </Section>

      {profile?.role === "admin" && (
        <Section title="TEAM MANAGEMENT">
          <TeamPanel />
        </Section>
      )}

      <Section title="ORGANISATION">
        <Row label="Org name">
          <input style={{ ...input, color: theme.color.slate }} value={settings.org_name || "Kraft Shipping & Logistics"} readOnly />
        </Row>
        <Row label="WhatsApp notification number">
          <input style={input} placeholder="+91XXXXXXXXXX" value={settings.whatsapp_number || ""} onChange={setS("whatsapp_number")} />
        </Row>
        <SaveButton onSave={() => persist(["whatsapp_number"], "org")} saved={saved.org} />
      </Section>

      <Section title="DEFAULTS">
        <div className="form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Row label="Tare 20ft (kg)"><input type="number" style={input} value={settings.tare_20 ?? ""} onChange={setS("tare_20")} /></Row>
          <Row label="Tare 40ft (kg)"><input type="number" style={input} value={settings.tare_40 ?? ""} onChange={setS("tare_40")} /></Row>
          <Row label="CML 20ft (kg)"><input type="number" style={input} value={settings.cml_20 ?? ""} onChange={setS("cml_20")} /></Row>
          <Row label="CML 40ft (kg)"><input type="number" style={input} value={settings.cml_40 ?? ""} onChange={setS("cml_40")} /></Row>
          <Row label="Default POL"><input style={input} value={settings.default_pol ?? ""} onChange={setS("default_pol")} /></Row>
          <Row label="Default POD"><input style={input} value={settings.default_pod ?? ""} onChange={setS("default_pod")} /></Row>
        </div>
        <SaveButton
          onSave={() => persist(["tare_20", "tare_40", "cml_20", "cml_40", "default_pol", "default_pod"], "defaults")}
          saved={saved.defaults}
        />
      </Section>
    </div>
    </div>
  );
}
