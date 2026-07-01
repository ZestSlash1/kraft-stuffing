import { useEffect, useState } from "react";
import { Download, Send, Ban } from "lucide-react";
import { theme } from "../theme";
import { Card, Pill } from "../components/ui";
import { useToast } from "../components/Toast";
import { fetchDocuments, getSignedDocumentUrl, voidDocument } from "../lib/documents";
import { supabase } from "../lib/supabase";
import { fmtIST } from "../lib/pdf/shared";
import { useRouter } from "../context/RouterContext";

const TYPE_LABELS = { hbl: "HBL", arrival_notice: "Arrival Notice", delivery_order: "Delivery Order" };
const STATUS_COLORS = {
  draft: theme.color.slate,
  issued: theme.color.green,
  void: theme.color.red,
};

export default function DocumentsView({ app }) {
  const { state } = app;
  const { route } = useRouter();
  const { showToast } = useToast();
  const [documents, setDocuments] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(route?.params?.status || "all");

  const reload = () => {
    fetchDocuments({
      type: typeFilter === "all" ? undefined : typeFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
    }).then(({ data, error }) => {
      if (error) {
        console.warn("[documents] fetch failed:", error.message);
        setDocuments([]);
        return;
      }
      setDocuments(data);
    });
  };

  useEffect(reload, [typeFilter, statusFilter]);

  const download = async (doc) => {
    if (!doc.pdfPath) return;
    const { url, error } = await getSignedDocumentUrl(doc.pdfPath);
    if (error || !url) {
      showToast("Could not create download link", "error");
      return;
    }
    window.open(url, "_blank", "noopener");
  };

  const onVoid = async (doc) => {
    if (!window.confirm(`Void ${doc.number || "this draft"}? This cannot be undone.`)) return;
    const { error } = await voidDocument(doc.id);
    if (error) {
      showToast(`Void failed: ${error.message}`, "error");
      return;
    }
    showToast(`${doc.number || "Document"} voided`, "success");
    reload();
  };

  const resend = async (doc) => {
    const { error } = await supabase.functions.invoke("notify-document", { body: { documentId: doc.id } });
    showToast(error ? `Send failed: ${error.message}` : "Sent via WhatsApp", error ? "error" : "success");
  };

  return (
    <div style={{ minHeight: "100%", background: theme.color.canvas, color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 18px 40px" }}>
        <div style={{ fontFamily: theme.font.condensed, fontWeight: 800, fontSize: 28, marginBottom: 4 }}>
          DOCUMENTS
        </div>
        <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate, marginBottom: 16 }}>
          House Bills of Lading, Arrival Notices &amp; Delivery Orders — issued documents are frozen snapshots.
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          <Pill
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            options={[{ value: "all", label: "All types" }, ...Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))]}
          />
          <Pill
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: "all", label: "All statuses" },
              { value: "draft", label: "Draft" },
              { value: "issued", label: "Issued" },
              { value: "void", label: "Void" },
            ]}
          />
        </div>

        {documents === null ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>Loading…</div>
        ) : documents.length === 0 ? (
          <div style={{ fontFamily: theme.font.mono, fontSize: 12, color: theme.color.slate }}>No documents yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {documents.map((doc) => {
              const voyage = state.voyages.find((v) => v.id === doc.voyageId);
              return (
                <Card key={doc.id} style={{ padding: "12px 16px", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 14, opacity: doc.status === "void" ? 0.6 : 1 }}>
                  <div style={{ width: 110, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                    {TYPE_LABELS[doc.type]}
                  </div>
                  <div style={{ flex: 1, minWidth: 140, overflowWrap: "break-word", fontFamily: theme.font.mono, fontSize: 13, textDecoration: doc.status === "void" ? "line-through" : "none" }}>
                    {doc.number || "— draft —"}
                    <div style={{ fontSize: 11, color: theme.color.slate, marginTop: 2 }}>
                      {voyage?.voyageNo || "—"} {voyage ? `· ${voyage.vessel}` : ""}
                    </div>
                  </div>
                  <div style={{ width: 110, fontFamily: theme.font.mono, fontSize: 11, color: STATUS_COLORS[doc.status] }}>
                    {doc.status.toUpperCase()}
                  </div>
                  <div style={{ width: 100, fontFamily: theme.font.mono, fontSize: 11, color: theme.color.slate }}>
                    {doc.issuedAt ? fmtIST(doc.issuedAt) : "—"}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {doc.pdfPath && (
                      <button onClick={() => download(doc)} title="Download" style={iconBtn}>
                        <Download size={14} />
                      </button>
                    )}
                    {doc.status === "issued" && (
                      <button onClick={() => resend(doc)} title="Send via WhatsApp" style={iconBtn}>
                        <Send size={14} />
                      </button>
                    )}
                    {doc.status !== "void" && (
                      <button onClick={() => onVoid(doc)} title="Void" style={{ ...iconBtn, color: theme.color.red }}>
                        <Ban size={14} />
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const iconBtn = {
  background: theme.color.surfaceMuted,
  border: `1px solid ${theme.color.border}`,
  color: theme.color.inkSoft,
  borderRadius: theme.radius.sm,
  padding: 7,
  cursor: "pointer",
  display: "flex",
};
