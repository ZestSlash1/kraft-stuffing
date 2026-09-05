import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Eye, Download, Trash2, Upload, Camera, Loader, RotateCw } from "lucide-react";
import { C, F, R, SP, glass, label } from "../ui/theme";
import { fetchAttachments, uploadAttachment, voidAttachment, getSignedAttachmentUrl } from "../lib/attachments";
import DocViewer from "./DocViewer";
import DocScanner from "./DocScanner";
import ConfirmDialog from "./ConfirmDialog";

// ─────────────────────────────────────────────────────────────────────────────
// AttachmentsPanel — glass panel of files hung off a voyage / booking / carting
// order. Lists non-voided attachments; view (DocViewer), download, and void
// (soft-delete, confirmed) per row. Upload + Scan are the two ways to add. All
// add/void actions require connectivity — offline they're disabled with a notice
// (binary uploads are never queued through the offline write path).
// ─────────────────────────────────────────────────────────────────────────────

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);

const fmtSize = (b) => {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

const fmtDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  } catch {
    return "";
  }
};

const isPdf = (mime) => mime === "application/pdf";

export default function AttachmentsPanel({ parentType, parentId, createdBy }) {
  const [items, setItems] = useState(null);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [uploads, setUploads] = useState([]); // { id, file, status: 'uploading' | 'error' }
  const [viewerDoc, setViewerDoc] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(null); // attachment id
  const inputRef = useRef(null);

  const reload = () => {
    if (!parentId) {
      setItems([]);
      return;
    }
    fetchAttachments({ parentType, parentId }).then(({ data, error }) => {
      if (error) {
        console.warn("[attachments] fetch failed:", error.message);
        setItems([]);
        return;
      }
      setItems(data);
    });
  };

  useEffect(reload, [parentType, parentId]);

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

  const runUpload = async (entry) => {
    setUploads((u) => u.map((x) => (x.id === entry.id ? { ...x, status: "uploading" } : x)));
    const { error } = await uploadAttachment({
      parentType,
      parentId,
      blob: entry.file,
      fileName: entry.file.name,
      mimeType: entry.file.type || "application/octet-stream",
      source: "upload",
      createdBy,
    });
    if (error) {
      console.warn("[attachments] upload failed:", error.message);
      setUploads((u) => u.map((x) => (x.id === entry.id ? { ...x, status: "error" } : x)));
    } else {
      setUploads((u) => u.filter((x) => x.id !== entry.id));
      reload();
    }
  };

  const onFiles = (fileList) => {
    const files = Array.from(fileList || []).filter((f) => f.type === "application/pdf" || f.type.startsWith("image/"));
    if (!files.length) return;
    const entries = files.map((file) => ({ id: uid(), file, status: "uploading" }));
    setUploads((u) => [...u, ...entries]);
    entries.forEach(runUpload);
  };

  const view = async (a) => {
    const { url, error } = await getSignedAttachmentUrl(a.storagePath);
    if (error || !url) return;
    setViewerDoc({ url, fileName: a.fileName, mimeType: a.mimeType });
  };

  const download = async (a) => {
    const { url, error } = await getSignedAttachmentUrl(a.storagePath);
    if (error || !url) return;
    const el = document.createElement("a");
    el.href = url;
    el.download = a.fileName || "attachment";
    el.target = "_blank";
    el.rel = "noopener";
    document.body.appendChild(el);
    el.click();
    el.remove();
  };

  const doVoid = async (id) => {
    setConfirmVoid(null);
    const { error } = await voidAttachment(id);
    if (!error) reload();
  };

  return (
    <div style={{ ...glass(R.card), padding: SP.lg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: SP.md, marginBottom: SP.md }}>
        <div style={{ ...label() }}>Attachments</div>
        <div style={{ display: "flex", gap: SP.sm }}>
          <button onClick={() => inputRef.current?.click()} disabled={!online} title={online ? "Upload PDF or images" : "Reconnect to upload"} style={addBtn(online)}>
            <Upload size={14} /> Upload
          </button>
          <button onClick={() => setScannerOpen(true)} disabled={!online} title={online ? "Scan with camera" : "Reconnect to scan"} style={addBtn(online)}>
            <Camera size={14} /> Scan
          </button>
        </div>
      </div>

      {!online && (
        <div style={{ fontFamily: F.mono, fontSize: 11, color: C.warning, marginBottom: SP.md }}>
          ● Offline — reconnect to upload or scan.
        </div>
      )}

      {/* In-flight uploads */}
      {uploads.map((u) => (
        <div key={u.id} style={row}>
          <span style={{ display: "flex", flexShrink: 0 }}>
            {u.status === "error" ? <RotateCw size={16} color={C.critical} /> : <Loader size={16} color={C.inkDim} className="att-spin" />}
          </span>
          <div style={{ flex: 1, minWidth: 0, fontFamily: F.mono, fontSize: 12, color: C.inkDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {u.file.name}
          </div>
          {u.status === "error" ? (
            <div style={{ display: "flex", alignItems: "center", gap: SP.sm }}>
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.critical }}>Failed</span>
              <button onClick={() => runUpload(u)} style={iconBtn()} title="Retry">
                <RotateCw size={14} />
              </button>
              <button onClick={() => setUploads((x) => x.filter((e) => e.id !== u.id))} style={iconBtn()} title="Dismiss">
                <Trash2 size={14} />
              </button>
            </div>
          ) : (
            <span style={{ fontFamily: F.mono, fontSize: 11, color: C.inkFaint }}>Uploading…</span>
          )}
        </div>
      ))}

      {/* Saved attachments */}
      {items === null ? (
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.inkDim, padding: `${SP.sm}px 0` }}>Loading…</div>
      ) : items.length === 0 && uploads.length === 0 ? (
        <div style={{ fontFamily: F.mono, fontSize: 12, color: C.inkFaint, padding: `${SP.sm}px 0` }}>No attachments yet.</div>
      ) : (
        items.map((a) => (
          <div key={a.id}>
            <div style={row}>
              <span style={{ display: "flex", flexShrink: 0, color: C.inkDim }}>
                {isPdf(a.mimeType) ? <FileText size={16} /> : <ImageIcon size={16} />}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 12, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {a.fileName}
                </div>
                <div style={{ fontFamily: F.mono, fontSize: 10, color: C.inkFaint, marginTop: 2 }}>
                  {fmtSize(a.sizeBytes)} · {fmtDate(a.createdAt)}
                  {a.source === "scan" ? " · scan" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => view(a)} title="View" style={iconBtn()}>
                  <Eye size={14} />
                </button>
                <button onClick={() => download(a)} title="Download" style={iconBtn()}>
                  <Download size={14} />
                </button>
                <button onClick={() => setConfirmVoid(a.id)} title="Void" style={iconBtn({ color: C.critical })}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {confirmVoid === a.id && (
              <ConfirmDialog
                message={`Void "${a.fileName}"? It stays in the audit trail but leaves this list.`}
                confirmLabel="VOID"
                onConfirm={() => doVoid(a.id)}
                onCancel={() => setConfirmVoid(null)}
              />
            )}
          </div>
        ))
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/*"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />

      <DocViewer open={!!viewerDoc} doc={viewerDoc} onClose={() => setViewerDoc(null)} />
      <DocScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        parentType={parentType}
        parentId={parentId}
        createdBy={createdBy}
        onSaved={reload}
      />

      <style>{`@keyframes attSpin { to { transform: rotate(360deg); } } .att-spin { animation: attSpin 0.9s linear infinite; }`}</style>
    </div>
  );
}

const row = {
  display: "flex",
  alignItems: "center",
  gap: SP.md,
  padding: `${SP.sm}px 0`,
  borderTop: `1px solid ${C.hair}`,
};

const iconBtn = (extra = {}) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 30,
  height: 30,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${C.hair}`,
  borderRadius: 8,
  color: C.inkDim,
  cursor: "pointer",
  ...extra,
});

const addBtn = (enabled) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  height: 32,
  padding: "0 12px",
  background: enabled ? "rgba(18,184,134,0.12)" : "rgba(255,255,255,0.05)",
  border: `1px solid ${enabled ? "rgba(18,184,134,0.35)" : C.hair}`,
  borderRadius: R.pill,
  color: enabled ? C.optimized : C.inkFaint,
  fontFamily: F.head,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: "0.03em",
  textTransform: "uppercase",
  cursor: enabled ? "pointer" : "not-allowed",
});
