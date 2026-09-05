import { useState } from "react";
import { FileText, Image as ImageIcon, FileSpreadsheet, File, MoreVertical, Trash2, Eye, Pencil, Check, X } from "lucide-react";
import { C, F, R, SP } from "../../../ui/theme";
import { supabase } from "../../../lib/supabase";
import { getSignedAttachmentUrl } from "../../../lib/attachments";
import DocViewer from "../../../components/DocViewer";

const BUCKET = "attachments";
const safeName = (name) => (name || "file").replace(/[^\w.-]+/g, "_").slice(-80);

const TYPE = (mime, name) => {
  const ext = (name || "").split(".").pop()?.toLowerCase() || "";
  if (mime === "application/pdf" || ext === "pdf") return { Icon: FileText, color: C.critical, label: "PDF" };
  if (mime?.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) return { Icon: ImageIcon, color: C.minor, label: "IMG" };
  if (["xls", "xlsx", "csv"].includes(ext) || mime?.includes("sheet")) return { Icon: FileSpreadsheet, color: C.optimized, label: "XLS" };
  return { Icon: File, color: C.inkDim, label: ext ? ext.toUpperCase().slice(0, 4) : "FILE" };
};

const fmtSize = (b) => {
  if (b == null) return "";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
};

// Uploads a file straight to the private `attachments` bucket under a per-user
// compose scratch prefix — no metadata table row (these are ephemeral to a draft;
// their refs travel with the send/schedule payload instead).
export async function uploadComposeAttachment(file, userId) {
  const path = `mail-compose/${userId}/${Date.now()}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw new Error(error.message || "Upload failed");
  return { id: path, fileName: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size, storagePath: path };
}

export async function removeComposeAttachment(storagePath) {
  await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {});
}

export default function AttachmentCards({ attachments, onChange }) {
  const [viewerDoc, setViewerDoc] = useState(null);
  const [menuFor, setMenuFor] = useState(null);
  const [renaming, setRenaming] = useState(null); // { id, value }

  if (!attachments.length) return null;

  const view = async (a) => {
    const { url } = await getSignedAttachmentUrl(a.storagePath);
    if (url) setViewerDoc({ url, fileName: a.fileName, mimeType: a.mimeType });
    setMenuFor(null);
  };

  const remove = (a) => {
    onChange(attachments.filter((x) => x.id !== a.id));
    if (a.storagePath) removeComposeAttachment(a.storagePath);
    setMenuFor(null);
  };

  const startRename = (a) => { setRenaming({ id: a.id, value: a.fileName }); setMenuFor(null); };
  const commitRename = () => {
    onChange(attachments.map((a) => (a.id === renaming.id ? { ...a, fileName: renaming.value } : a)));
    setRenaming(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: SP.sm }}>
      <span style={{ font: `600 11px/1 ${F.head}`, letterSpacing: "0.1em", textTransform: "uppercase", color: C.inkFaint }}>
        {attachments.length} attachment{attachments.length === 1 ? "" : "s"}
      </span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: SP.sm }}>
        {attachments.map((a) => {
          const { Icon, color, label } = TYPE(a.mimeType, a.fileName);
          const isRenaming = renaming?.id === a.id;
          return (
            <div
              key={a.id}
              style={{
                position: "relative", display: "flex", alignItems: "center", gap: SP.sm,
                background: "rgba(255,255,255,0.04)", border: `1px solid ${C.hair}`, borderRadius: R.chip,
                padding: `${SP.sm}px ${SP.md}px`, width: 220, boxSizing: "border-box",
                opacity: a.uploading ? 0.6 : 1,
              }}
            >
              <span
                style={{
                  width: 30, height: 30, borderRadius: 7, flexShrink: 0, display: "flex", alignItems: "center",
                  justifyContent: "center", background: `${color}22`, color,
                }}
                title={label}
              >
                <Icon size={15} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {isRenaming ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      autoFocus
                      value={renaming.value}
                      onChange={(e) => setRenaming({ ...renaming, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenaming(null); }}
                      style={{ width: "100%", background: "transparent", border: `1px solid ${C.hair}`, borderRadius: 5, color: C.ink, font: `500 12px ${F.mono}`, padding: "2px 5px" }}
                    />
                    <button onClick={commitRename} style={iconBtn} title="Save"><Check size={12} /></button>
                    <button onClick={() => setRenaming(null)} style={iconBtn} title="Cancel"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <div style={{ font: `600 12px ${F.mono}`, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {a.fileName}
                    </div>
                    <div style={{ font: `400 10px ${F.mono}`, color: C.inkFaint, marginTop: 2 }}>
                      {a.uploading ? "Uploading…" : fmtSize(a.sizeBytes)}
                    </div>
                  </>
                )}
              </div>
              {!isRenaming && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <button onClick={() => setMenuFor(menuFor === a.id ? null : a.id)} style={iconBtn} title="More">
                    <MoreVertical size={14} />
                  </button>
                  {menuFor === a.id && (
                    <>
                      <div onClick={() => setMenuFor(null)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 21,
                          background: C.surface, border: `1px solid ${C.border}`, borderRadius: R.chip,
                          boxShadow: "0 12px 28px -12px rgba(0,0,0,0.6)", padding: 4, minWidth: 130,
                        }}
                      >
                        {a.mimeType === "application/pdf" && <MenuRow Icon={Eye} label="Preview" onClick={() => view(a)} />}
                        <MenuRow Icon={Pencil} label="Rename" onClick={() => startRename(a)} />
                        <MenuRow Icon={Trash2} label="Remove" danger onClick={() => remove(a)} />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <DocViewer open={!!viewerDoc} doc={viewerDoc} onClose={() => setViewerDoc(null)} />
    </div>
  );
}

function MenuRow({ Icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: SP.sm, width: "100%", background: "none", border: "none",
        borderRadius: R.chip - 2, padding: "7px 8px", cursor: "pointer", textAlign: "left",
        color: danger ? C.critical : C.ink, font: `500 12px ${F.mono}`,
      }}
    >
      <Icon size={13} /> {label}
    </button>
  );
}

const iconBtn = {
  display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22,
  background: "none", border: "none", borderRadius: 6, color: C.inkFaint, cursor: "pointer",
};
