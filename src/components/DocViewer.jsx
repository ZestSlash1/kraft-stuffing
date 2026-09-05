import { useEffect, useRef, useState } from "react";
import { X, ZoomIn, ZoomOut, Download, Share2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { C, F, SP, glass } from "../ui/theme";

// pdf.js is heavy (~1 MB); load it — and its worker — only when a PDF is opened,
// so it lands in its own async chunk instead of the main bundle. Cached after
// the first open.
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import("pdfjs-dist/build/pdf.mjs"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// DocViewer — read-only, full-screen glass overlay for PDFs and images. Renders
// one PDF page at a time (only the current page is ever painted — the cheapest
// form of the ±1 virtualization the spec asks for). No annotation/editing in v1.
//
// Presentation-only: the caller resolves a signed URL and passes it in.
//   doc = { url, fileName, mimeType }
// ─────────────────────────────────────────────────────────────────────────────

const isImage = (mime) => /^image\//.test(mime || "");

export default function DocViewer({ open, doc, onClose }) {
  if (!open || !doc) return null;
  return <Viewer doc={doc} onClose={onClose} />;
}

function Viewer({ doc, onClose }) {
  const { url, fileName, mimeType } = doc;
  const image = isImage(mimeType);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const pdfRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [numPages, setNumPages] = useState(image ? 1 : 0);
  const [page, setPage] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(!image);
  const [error, setError] = useState(null);

  // Esc to close.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (!image && e.key === "ArrowRight") setPage((p) => Math.min(p + 1, numPages || 1));
      else if (!image && e.key === "ArrowLeft") setPage((p) => Math.max(p - 1, 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [image, numPages, onClose]);

  // Load the PDF document once.
  useEffect(() => {
    if (image || !url) return;
    let cancelled = false;
    let task = null;
    setLoading(true);
    setError(null);
    loadPdfjs()
      .then((pdfjsLib) => {
        if (cancelled) return null;
        task = pdfjsLib.getDocument({ url });
        return task.promise;
      })
      .then((pdf) => {
        if (cancelled || !pdf) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setPage(1);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("[DocViewer] load failed:", err?.message);
        setError("Could not open this document.");
        setLoading(false);
      });
    return () => {
      cancelled = true;
      task?.destroy?.();
      pdfRef.current = null;
    };
  }, [url, image]);

  // Render the current page whenever page/zoom changes (only this page paints).
  useEffect(() => {
    if (image) return;
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;
    let cancelled = false;

    (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const wrapW = (wrapRef.current?.clientWidth || 800) - SP.xl * 2;
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = Math.min(wrapW / base.width, 2.5); // fit-to-width baseline
        const viewport = pdfPage.getViewport({ scale: Math.max(0.2, fit * zoom) });
        const ctx = canvas.getContext("2d");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        renderTaskRef.current?.cancel?.();
        const task = pdfPage.render({ canvasContext: ctx, viewport });
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (!cancelled && err?.name !== "RenderingCancelledException") {
          console.warn("[DocViewer] render failed:", err?.message);
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
    };
  }, [page, zoom, image, numPages]);

  const download = () => {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "document";
    a.target = "_blank";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const share = async () => {
    try {
      await navigator.share({ title: fileName || "Document", url });
    } catch {
      // user cancelled or share unsupported mid-flight — no-op
    }
  };

  const btn = (extra = {}) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 34,
    minWidth: 34,
    padding: "0 10px",
    background: "rgba(255,255,255,0.06)",
    border: `1px solid ${C.hair}`,
    borderRadius: 999,
    color: C.inkDim,
    cursor: "pointer",
    fontFamily: F.mono,
    fontSize: 11,
    ...extra,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(2,4,7,0.86)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div
        style={{
          ...glass(0),
          borderRadius: 0,
          borderLeft: "none",
          borderRight: "none",
          borderTop: "none",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 14px",
          flexShrink: 0,
        }}
      >
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1, minWidth: 0 }}>
          {fileName || "Document"}
        </span>

        {!image && numPages > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button style={btn()} onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page <= 1} title="Previous page">
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkDim, minWidth: 54, textAlign: "center" }}>
              {page} / {numPages}
            </span>
            <button style={btn()} onClick={() => setPage((p) => Math.min(p + 1, numPages))} disabled={page >= numPages} title="Next page">
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        <button style={btn()} onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(2)))} title="Zoom out">
          <ZoomOut size={16} />
        </button>
        <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkDim, minWidth: 40, textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
        <button style={btn()} onClick={() => setZoom((z) => Math.min(4, +(z + 0.2).toFixed(2)))} title="Zoom in">
          <ZoomIn size={16} />
        </button>

        <button style={btn()} onClick={download} title="Download">
          <Download size={16} />
        </button>
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ ...btn(), textDecoration: "none" }} title="Open in new tab">
          <ExternalLink size={16} />
        </a>
        {typeof navigator !== "undefined" && navigator.share && (
          <button style={btn()} onClick={share} title="Share">
            <Share2 size={16} />
          </button>
        )}
        <button style={btn({ color: C.ink })} onClick={onClose} title="Close">
          <X size={18} />
        </button>
      </div>

      {/* Canvas / image area */}
      <div ref={wrapRef} style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: SP.xl }}>
        {loading && <Centered>Loading…</Centered>}
        {error && <Centered>{error}</Centered>}
        {!error && image ? (
          <img
            src={url}
            alt={fileName || "attachment"}
            style={{ maxWidth: "none", width: `${zoom * 100}%`, height: "auto", borderRadius: 8, boxShadow: "0 30px 60px -30px rgba(0,0,0,0.85)" }}
          />
        ) : (
          !error && !loading && <canvas ref={canvasRef} style={{ borderRadius: 4, boxShadow: "0 30px 60px -30px rgba(0,0,0,0.85)", background: "#fff" }} />
        )}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return (
    <div style={{ margin: "auto", fontFamily: F.mono, fontSize: 12, color: C.inkDim, letterSpacing: "0.08em" }}>{children}</div>
  );
}
