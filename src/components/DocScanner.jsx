import { useEffect, useRef, useState } from "react";
import { jsPDF } from "jspdf";
import { Camera, RotateCw, ArrowUp, ArrowDown, Trash2, X, Loader } from "lucide-react";
import { C, F, R, SP, glass, label } from "../ui/theme";
import { uploadAttachment } from "../lib/attachments";

// ─────────────────────────────────────────────────────────────────────────────
// DocScanner — capture document pages with the native camera (or file picker on
// desktop), review/reorder/rotate/remove, then compose + upload. It NEVER
// auto-uploads: the user captures, reviews, and explicitly hits Save. Binary
// upload is online-only, so capture + save are disabled offline with a notice.
//
// Save path: each page is downscaled client-side (long edge ≤ 2000px, JPEG
// ~0.8). A single page uploads as a JPEG (smaller); multiple pages compose into
// one A4 PDF via the already-present jsPDF, one page per image, fit-with-margins.
// ─────────────────────────────────────────────────────────────────────────────

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

// A4 in points (matches the app's other jsPDF exports) + a comfortable margin.
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 28;
const MAX_EDGE = 2000;

// Draw one page to a canvas honouring rotation + downscale; return blob + dims.
async function processPage(page) {
  const bitmap = await createImageBitmap(page.file, { imageOrientation: "from-image" }).catch(() =>
    createImageBitmap(page.file)
  );
  const { width, height } = bitmap;
  const swap = page.rotation % 180 !== 0;
  const orientedW = swap ? height : width;
  const orientedH = swap ? width : height;
  const scale = Math.min(1, MAX_EDGE / Math.max(orientedW, orientedH));
  const outW = Math.max(1, Math.round(orientedW * scale));
  const outH = Math.max(1, Math.round(orientedH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outW, outH);
  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((page.rotation * Math.PI) / 180);
  ctx.drawImage(bitmap, (-width * scale) / 2, (-height * scale) / 2, width * scale, height * scale);
  ctx.restore();
  bitmap.close?.();

  const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.8));
  const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
  return { blob, dataUrl, w: outW, h: outH };
}

export default function DocScanner({ open, onClose, parentType, parentId, createdBy, onSaved }) {
  const [pages, setPages] = useState([]); // { id, file, url, rotation }
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Revoke thumbnail object URLs on unmount to avoid leaks.
  useEffect(() => {
    return () => pages.forEach((p) => URL.revokeObjectURL(p.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPages((prev) => [...prev, ...files.map((file) => ({ id: uid(), file, url: URL.createObjectURL(file), rotation: 0 }))]);
    setError(null);
  };

  const rotate = (id) => setPages((prev) => prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
  const remove = (id) =>
    setPages((prev) => {
      const gone = prev.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((p) => p.id !== id);
    });
  const move = (idx, dir) =>
    setPages((prev) => {
      const next = [...prev];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });

  const close = () => {
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setError(null);
    setSaving(false);
    onClose();
  };

  const save = async () => {
    if (!pages.length || saving || !online) return;
    setSaving(true);
    setError(null);
    try {
      const processed = [];
      for (const p of pages) processed.push(await processPage(p));

      let blob, fileName, mimeType;
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");

      if (processed.length === 1) {
        blob = processed[0].blob;
        fileName = `Scan-${stamp}.jpg`;
        mimeType = "image/jpeg";
      } else {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        processed.forEach((pg, i) => {
          if (i > 0) doc.addPage();
          const availW = A4.w - MARGIN * 2;
          const availH = A4.h - MARGIN * 2;
          const fit = Math.min(availW / pg.w, availH / pg.h);
          const w = pg.w * fit;
          const h = pg.h * fit;
          doc.addImage(pg.dataUrl, "JPEG", (A4.w - w) / 2, (A4.h - h) / 2, w, h);
        });
        blob = doc.output("blob");
        fileName = `Scan-${stamp}.pdf`;
        mimeType = "application/pdf";
      }

      const { error: upErr } = await uploadAttachment({
        parentType,
        parentId,
        blob,
        fileName,
        mimeType,
        source: "scan",
        createdBy,
      });
      if (upErr) throw upErr;

      onSaved?.();
      close();
    } catch (err) {
      console.warn("[DocScanner] save failed:", err?.message);
      setError("Save failed — tap Save to retry.");
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(2,4,7,0.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ ...glass(0), borderRadius: 0, borderLeft: "none", borderRight: "none", borderTop: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", flexShrink: 0 }}>
        <span style={{ fontFamily: F.head, fontWeight: 800, fontSize: 18, letterSpacing: "0.03em", color: C.ink }}>SCAN DOCUMENT</span>
        <button onClick={close} title="Close" style={iconBtn({ color: C.ink })}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: SP.lg }}>
        {!online && (
          <div style={{ ...glass(R.chip), background: "rgba(232,147,10,0.12)", border: `1px solid rgba(232,147,10,0.35)`, color: C.warning, fontFamily: F.mono, fontSize: 12, padding: "10px 14px", marginBottom: SP.lg }}>
            ● Offline — reconnect to capture &amp; upload. Nothing is saved until you're back online.
          </div>
        )}

        {pages.length === 0 ? (
          <div style={{ ...glass(R.card), padding: SP.xxl, display: "flex", flexDirection: "column", alignItems: "center", gap: SP.md, textAlign: "center" }}>
            <Camera size={32} color={C.inkDim} />
            <div style={{ fontFamily: F.mono, fontSize: 12, color: C.inkDim, maxWidth: 360 }}>
              Capture one photo per page. Review, reorder and rotate before saving — a single page saves as an image, multiple pages compose into one PDF.
            </div>
            <button onClick={() => inputRef.current?.click()} disabled={!online} style={primaryBtn(online)}>
              <Camera size={16} /> Capture pages
            </button>
          </div>
        ) : (
          <>
            <div style={{ ...label(), marginBottom: SP.sm }}>
              {pages.length} page{pages.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: SP.md }}>
              {pages.map((p, i) => (
                <div key={p.id} style={{ ...glass(R.chip), overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  <div style={{ position: "relative", height: 150, background: "#0b1016", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    <img src={p.url} alt={`page ${i + 1}`} style={{ maxWidth: "100%", maxHeight: "100%", transform: `rotate(${p.rotation}deg)`, transition: "transform .15s ease" }} />
                    <span style={{ position: "absolute", top: 6, left: 6, fontFamily: F.mono, fontSize: 10, color: C.ink, background: "rgba(0,0,0,0.5)", borderRadius: 6, padding: "2px 6px" }}>
                      {i + 1}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 4, padding: 6, borderTop: `1px solid ${C.hair}` }}>
                    <button onClick={() => move(i, -1)} disabled={i === 0} title="Move up" style={miniBtn}>
                      <ArrowUp size={14} />
                    </button>
                    <button onClick={() => move(i, 1)} disabled={i === pages.length - 1} title="Move down" style={miniBtn}>
                      <ArrowDown size={14} />
                    </button>
                    <button onClick={() => rotate(p.id)} title="Rotate 90°" style={miniBtn}>
                      <RotateCw size={14} />
                    </button>
                    <button onClick={() => remove(p.id)} title="Remove" style={{ ...miniBtn, color: C.critical, marginLeft: "auto" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => inputRef.current?.click()} disabled={!online} style={{ ...primaryBtn(online), background: "rgba(255,255,255,0.06)", color: C.ink, border: `1px solid ${C.hair}`, marginTop: SP.lg }}>
              <Camera size={16} /> Add more pages
            </button>
          </>
        )}

        {error && (
          <div style={{ fontFamily: F.mono, fontSize: 12, color: C.critical, marginTop: SP.lg }}>{error}</div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ ...glass(0), borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: SP.md, padding: "12px 16px", flexShrink: 0, paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}>
        <button onClick={close} style={iconBtn({ padding: "0 16px", minWidth: 0, fontFamily: F.head, fontWeight: 700, fontSize: 13, letterSpacing: "0.04em", textTransform: "uppercase" })}>
          Cancel
        </button>
        <button onClick={save} disabled={!pages.length || saving || !online} style={primaryBtn(pages.length && !saving && online)}>
          {saving ? <Loader size={16} className="spin" /> : null}
          {saving ? "Saving…" : `Save ${pages.length > 1 ? `(${pages.length} pages)` : ""}`}
        </button>
      </div>

      {/* Native camera on mobile; file picker fallback on desktop. */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } } .spin { animation: spin 0.9s linear infinite; }`}</style>
    </div>
  );
}

const iconBtn = (extra = {}) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 36,
  minWidth: 36,
  padding: "0 10px",
  background: "rgba(255,255,255,0.06)",
  border: `1px solid ${C.hair}`,
  borderRadius: R.pill,
  color: C.inkDim,
  cursor: "pointer",
  fontFamily: F.mono,
  fontSize: 12,
  ...extra,
});

const miniBtn = {
  flex: "0 0 auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 26,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${C.hair}`,
  borderRadius: 8,
  color: C.inkDim,
  cursor: "pointer",
};

const primaryBtn = (enabled) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 40,
  padding: "0 18px",
  background: enabled ? C.optimized : "rgba(255,255,255,0.06)",
  color: enabled ? C.void : C.inkFaint,
  border: "none",
  borderRadius: R.pill,
  fontFamily: F.head,
  fontWeight: 800,
  fontSize: 14,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: enabled ? "pointer" : "not-allowed",
});
