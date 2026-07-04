import { TOKENS } from "../data/statusHelpers";

const initials = (name) =>
  (name || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

// Shows up to 3 avatar circles for users currently active on `containerId`.
// A green pulse dot appears on an avatar if its presence was updated <5s ago.
export default function PresenceAvatars({ presenceMap = {}, containerId }) {
  if (!containerId) return null;
  const now = Date.now();
  const active = Object.values(presenceMap || {})
    .filter((p) => p?.containerId === containerId)
    .slice(0, 3);

  if (active.length === 0) return null;

  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {active.map((p, i) => {
        const recent = p.lastSeen && now - p.lastSeen < 5000;
        return (
          <div
            key={p.userId || i}
            title={p.displayName}
            style={{
              position: "relative",
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: TOKENS.amber,
              color: "#1a1206",
              fontFamily: TOKENS.mono,
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginLeft: i === 0 ? 0 : -8,
              border: "2px solid rgba(255,255,255,0.18)",
              boxShadow: recent ? "0 0 10px rgba(18,184,134,0.45)" : "0 0 0 2px rgba(3,5,8,0.6)",
              flexShrink: 0,
            }}
          >
            {initials(p.displayName)}
            {recent && (
              <span
                style={{
                  position: "absolute",
                  top: -2,
                  right: -2,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: TOKENS.green,
                  boxShadow: `0 0 4px ${TOKENS.green}`,
                  border: `1px solid ${TOKENS.bg}`,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
