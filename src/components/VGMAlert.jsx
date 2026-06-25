import { TOKENS } from "../data/statusHelpers";

export function grossKgOf(container) {
  const cargoKg = (container.lines || []).reduce(
    (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
    0
  );
  return cargoKg + Number(container.tareWeightKg ?? 2200);
}

// Weight banner: red if over CML, amber if within 5% of it, otherwise a
// subtle steel-colored VGM readout.
export default function VGMAlert({ container }) {
  const grossKg = grossKgOf(container);
  const cmlKg = Number(container.cmlKg ?? 28000);
  const vgmMt = (grossKg / 1000).toFixed(2);

  if (grossKg > cmlKg) {
    const overBy = Math.round(grossKg - cmlKg);
    return (
      <div
        style={{
          background: "#3a0808",
          color: "#ff8080",
          fontFamily: TOKENS.mono,
          fontSize: 11,
          padding: "6px 10px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        ⚠ Over CML by {overBy.toLocaleString()} kg — VGM: {vgmMt} MT
      </div>
    );
  }

  if (grossKg > cmlKg * 0.95) {
    return (
      <div
        style={{
          background: "#3a2008",
          color: TOKENS.amber,
          fontFamily: TOKENS.mono,
          fontSize: 11,
          padding: "6px 10px",
          borderRadius: 4,
          fontWeight: 600,
        }}
      >
        Approaching CML — VGM: {vgmMt} MT
      </div>
    );
  }

  return (
    <div
      style={{
        color: "#8a9aaa",
        fontFamily: TOKENS.mono,
        fontSize: 11,
        padding: "2px 0",
      }}
    >
      VGM: {vgmMt} MT
    </div>
  );
}
