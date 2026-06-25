import { createCanvas } from "canvas";
import { writeFileSync } from "fs";
import { resolve } from "path";

const AMBER = "#e8930a";
const INK = "#ffffff";

function drawIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = AMBER;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = INK;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(size * 0.5)}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  ctx.fillText("KS", size / 2, size / 2 + size * 0.04);

  return canvas.toBuffer("image/png");
}

const outDir = resolve(import.meta.dirname, "../public");
writeFileSync(resolve(outDir, "icon-192.png"), drawIcon(192));
writeFileSync(resolve(outDir, "icon-512.png"), drawIcon(512));
console.log("Generated public/icon-192.png and public/icon-512.png");
