import { CARGO_COLORS } from "../data/statusHelpers";
import { theme } from "../theme";

// 44x20px proportional fill strip: one segment per cargo type, width scaled to
// its share of total qty. Purely decorative — no logic depends on it.
export default function CrossSectionFill({ container }) {
  const lines = container?.lines || [];
  const total = lines.reduce((a, l) => a + Number(l.qty || 0), 0);

  const segments = [];
  if (total > 0) {
    const byCargo = new Map();
    for (const l of lines) {
      const qty = Number(l.qty || 0);
      byCargo.set(l.cargo, (byCargo.get(l.cargo) || 0) + qty);
    }
    for (const [cargo, qty] of byCargo) {
      segments.push({ cargo, pct: qty / total, color: CARGO_COLORS[cargo] || CARGO_COLORS.default });
    }
  }

  return (
    <div
      style={{
        width: 44,
        height: 20,
        flexShrink: 0,
        display: "flex",
        border: `1px solid ${theme.color.borderStrong}`,
        borderRadius: 4,
        background: theme.color.surfaceMuted,
        overflow: "hidden",
      }}
    >
      {segments.length === 0 ? (
        <div style={{ flex: 1 }} />
      ) : (
        segments.map((s, i) => (
          <div
            key={s.cargo || i}
            title={s.cargo}
            style={{ height: "100%", width: `${s.pct * 100}%`, background: s.color }}
          />
        ))
      )}
    </div>
  );
}
