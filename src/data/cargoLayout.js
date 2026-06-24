export function calcBagPositions({ W = 2.2, H = 2.4, D = 5.6 } = {}, totalBags = 0) {
  const BW = 0.44, BH = 0.30, BD = 0.52;
  const PADDING = 0.06;

  const cols = Math.floor((W - PADDING * 2) / BW);
  const rows = Math.floor((H - PADDING * 2) / BH);
  const depth = Math.floor((D - PADDING * 2) / BD);

  const maxBags = cols * rows * depth;
  const count = Math.min(totalBags, maxBags, 320);

  const positions = [];
  outer: for (let d = 0; d < depth; d++) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (positions.length >= count) break outer;
        positions.push({
          x: -W / 2 + PADDING + BW / 2 + c * BW,
          y: -H / 2 + PADDING + BH / 2 + r * BH,
          z: D / 2 - PADDING - BD / 2 - d * BD,
        });
      }
    }
  }
  return positions;
}
