import { useEffect, useState } from "react";
import { UserPlus, Check } from "lucide-react";
import { theme } from "../../theme";
import { mailApi } from "../../lib/mailApi";

const cell = {
  fontFamily: theme.font.mono,
  fontSize: 12,
  color: theme.color.inkSoft,
  padding: "10px 12px",
  borderBottom: `1px solid ${theme.color.border}`,
};

const editInput = {
  width: "100%",
  boxSizing: "border-box",
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  padding: "6px 8px",
  fontFamily: theme.font.mono,
  fontSize: 12,
  color: theme.color.ink,
  outline: "none",
};

export default function TeamView() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = () => {
    setLoading(true);
    mailApi
      .team()
      .then((r) => setTeam(r.team || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const patch = (id, field, value) =>
    setTeam((prev) => prev.map((m) => (m.id === id ? { ...m, [field]: value } : m)));

  const save = async (m) => {
    setSavingId(m.id);
    try {
      await mailApi.updateMember(m.id, { full_name: m.full_name, title: m.title, role: m.role });
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  };

  const invite = async () => {
    if (!inviteEmail.includes("@")) return;
    setInviting(true);
    setError("");
    try {
      await mailApi.invite({ email: inviteEmail });
      setInviteEmail("");
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setInviting(false);
    }
  };

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "32px 24px" }}>
      <div
        style={{
          fontFamily: theme.font.condensed,
          fontWeight: 800,
          fontSize: 24,
          letterSpacing: "0.02em",
          color: theme.color.ink,
          marginBottom: 6,
        }}
      >
        TEAM
      </div>
      <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginBottom: 20 }}>
        Manage names, titles and roles. Mailbox credentials stay private — never shown here.
      </div>

      {/* Invite */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        <input
          placeholder="new.member@shafrina.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !inviting && invite()}
          style={{ ...editInput, maxWidth: 320, padding: "10px 12px", fontSize: 13 }}
        />
        <button
          onClick={invite}
          disabled={inviting}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            border: "none",
            borderRadius: theme.radius.sm,
            background: theme.color.amber,
            color: theme.color.white,
            fontFamily: theme.font.condensed,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "0 16px",
            cursor: inviting ? "wait" : "pointer",
          }}
        >
          <UserPlus size={15} /> {inviting ? "Inviting…" : "Invite"}
        </button>
      </div>

      {error && <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.red, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>Loading team…</div>
      ) : (
        <div style={{ border: `1px solid ${theme.color.border}`, borderRadius: theme.radius.card, overflow: "hidden", background: theme.color.surface }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Name", "Title", "Role", "Mail", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      fontFamily: theme.font.mono,
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: theme.color.slate,
                      padding: "12px",
                      borderBottom: `1px solid ${theme.color.border}`,
                      background: theme.color.surfaceMuted,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {team.map((m) => (
                <tr key={m.id}>
                  <td style={cell}>
                    <input value={m.full_name} onChange={(e) => patch(m.id, "full_name", e.target.value)} style={editInput} />
                  </td>
                  <td style={cell}>
                    <input value={m.title} onChange={(e) => patch(m.id, "title", e.target.value)} style={editInput} />
                  </td>
                  <td style={cell}>
                    <select
                      value={m.role}
                      onChange={(e) => patch(m.id, "role", e.target.value)}
                      style={{ ...editInput, cursor: "pointer" }}
                    >
                      <option value="staff">staff</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td style={cell}>
                    {m.mail_connected ? (
                      <span style={{ color: theme.color.green, fontWeight: 600 }}>● yes</span>
                    ) : (
                      <span style={{ color: theme.color.slateFaint }}>○ no</span>
                    )}
                  </td>
                  <td style={cell}>
                    <button
                      onClick={() => save(m)}
                      disabled={savingId === m.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: theme.color.surface,
                        border: `1px solid ${theme.color.borderStrong}`,
                        borderRadius: theme.radius.sm,
                        color: theme.color.inkSoft,
                        fontFamily: theme.font.condensed,
                        fontWeight: 700,
                        fontSize: 12,
                        textTransform: "uppercase",
                        padding: "6px 12px",
                        cursor: "pointer",
                      }}
                    >
                      <Check size={13} /> {savingId === m.id ? "…" : "Save"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
