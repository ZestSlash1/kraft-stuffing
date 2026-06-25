import { useState } from "react";
import { supabase } from "../lib/supabase";
import { saveOrgSettings, KRAFT_ORG_ID } from "../lib/db";
import { TOKENS } from "../data/statusHelpers";
import { useToast } from "../components/Toast";
import { useAuth } from "../context/AuthContext";

const input = {
  width: "100%",
  boxSizing: "border-box",
  background: TOKENS.bg,
  border: `1px solid ${TOKENS.border}`,
  borderRadius: 0,
  color: "#e2e8f0",
  padding: "10px 12px",
  fontFamily: TOKENS.mono,
  fontSize: 13,
  outline: "none",
};

function Section({ title, children }) {
  return (
    <div style={{ padding: "22px 0", borderBottom: `1px solid ${TOKENS.border}` }}>
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
        style={{ background: TOKENS.amber, border: "none", color: TOKENS.bg, fontFamily: TOKENS.condensed, fontWeight: 700, fontSize: 13, textTransform: "uppercase", padding: "9px 18px", cursor: "pointer" }}
      >
        Save Settings
      </button>
      {saved && <span style={{ fontFamily: TOKENS.mono, fontSize: 12, color: TOKENS.green }}>Saved ✓</span>}
    </div>
  );
}

export default function SettingsView({ app }) {
  const { user, profile } = useAuth();
  const { orgSettings, setOrgSettings } = app;
  const { showToast } = useToast();

  const [displayName, setDisplayName] = useState(profile?.displayName || "");
  const [settings, setSettings] = useState(orgSettings || {});
  const [saved, setSaved] = useState({});

  const flash = (key) => {
    setSaved((s) => ({ ...s, [key]: true }));
    setTimeout(() => setSaved((s) => ({ ...s, [key]: false })), 2000);
  };

  const setS = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value }));

  const saveProfile = async () => {
    await supabase.from("profiles").upsert(
      { id: user.id, org_id: KRAFT_ORG_ID, display_name: displayName },
      { onConflict: "id" }
    );
    flash("profile");
    showToast("Profile saved", "success");
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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "16px 18px 50px" }}>
      <div style={{ fontFamily: TOKENS.condensed, fontWeight: 800, fontSize: 28, color: "#e8eef4", marginBottom: 4 }}>
        SETTINGS
      </div>

      <Section title="PROFILE">
        <Row label="Display name">
          <input style={input} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </Row>
        <Row label="Email">
          <input style={{ ...input, color: TOKENS.steel }} value={user?.email || ""} readOnly />
        </Row>
        <Row label="Role">
          <span style={{ fontFamily: TOKENS.mono, fontSize: 11, color: TOKENS.amber, border: `1px solid ${TOKENS.amber}`, padding: "3px 8px", borderRadius: 3 }}>
            {(profile?.role || "staff").toUpperCase()}
          </span>
        </Row>
        <SaveButton onSave={saveProfile} saved={saved.profile} />
        <button
          onClick={signOut}
          style={{ marginTop: 16, background: "none", border: `1px solid ${TOKENS.red}`, color: TOKENS.red, fontFamily: TOKENS.condensed, fontWeight: 700, fontSize: 14, textTransform: "uppercase", padding: "10px 18px", cursor: "pointer", width: "100%" }}
        >
          Sign Out
        </button>
      </Section>

      <Section title="ORGANISATION">
        <Row label="Org name">
          <input style={{ ...input, color: TOKENS.steel }} value={settings.org_name || "Kraft Shipping & Logistics"} readOnly />
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
  );
}
