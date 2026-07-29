import { useState } from "react";
import { AlertTriangle, Download, FileJson, RefreshCw } from "lucide-react";
import { theme } from "../../theme";
import { C } from "../../ui/theme";
import { fetchIgmVoyageTree } from "../../lib/igm";
import {
  MAPPING_VERSION,
  downloadIgmJson,
  generateIgmJson,
  igmExportSummary,
  igmFileName,
} from "../../lib/igmExport";
import { EmptyState, Section, mono, primaryBtn, secondaryBtn } from "./igmChrome";

// Export panel on the voyage detail view: builds the whole voyage tree, shows a
// summary + blockers/warnings, and only then offers the download. Nothing is
// submitted anywhere — the file is for manual ICEGATE upload.
export default function IgmExportPanel({ voyageId, showToast }) {
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const build = async () => {
    setLoading(true);
    const { data, error } = await fetchIgmVoyageTree(voyageId);
    setLoading(false);
    if (error || !data) {
      showToast?.(`Could not build export: ${error?.message || "unknown"}`, "error");
      return null;
    }
    setTree(data);
    return data;
  };

  const summary = tree ? igmExportSummary(tree) : null;

  const onDownload = async () => {
    const data = tree || (await build());
    if (!data) return;
    const { error } = downloadIgmJson(data);
    if (error) {
      showToast?.(error.message, "error");
      return;
    }
    showToast?.(`Downloaded ${igmFileName(data)}`, "success");
  };

  return (
    <Section
      id="igm-export"
      title="ICEGATE JSON export"
      subtitle={`Serialises the voyage, its BLs, parties, cargo and container lines into one file for manual upload. Mapping: ${MAPPING_VERSION}.`}
      right={
        <button onClick={build} disabled={loading} style={secondaryBtn}>
          <RefreshCw size={13} /> {tree ? "Rebuild" : "Build preview"}
        </button>
      }
    >
      {/* The field mapping is not yet reconciled against a real ICEGATE sample —
          say so on the surface where someone is about to file it. */}
      <div
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-start",
          background: "rgba(232,147,10,0.10)",
          border: `1px solid rgba(232,147,10,0.35)`,
          borderRadius: theme.radius.sm,
          padding: "10px 12px",
          marginBottom: 14,
        }}
      >
        <AlertTriangle size={14} color={C.warning} style={{ flexShrink: 0, marginTop: 1 }} />
        <span style={{ ...mono(11, C.warning), lineHeight: 1.6 }}>
          Placeholder field names. The structure is complete but the key names have not been
          verified against real ICEGATE output yet, so check the file before filing. Only{" "}
          <code>src/lib/igmExport.js</code> changes when the confirmed mapping arrives.
        </span>
      </div>

      {!tree ? (
        <EmptyState>
          {loading ? "Building…" : "Build the preview to see what this voyage will export."}
        </EmptyState>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <Stat label="Bills of lading" value={summary.blCount} />
            <Stat label="Containers" value={summary.totals.containers} />
            <Stat label="Cargo lines" value={summary.totals.cargoLines} />
            <Stat label="Gross wt (declared)" value={summary.totals.declaredGrossWt.toFixed(2)} />
            <Stat label="Gross wt (containers)" value={summary.totals.containerGrossWt.toFixed(2)} />
          </div>

          {summary.blockers.length > 0 && (
            <IssueList
              title="Blockers"
              color={theme.color.red}
              items={summary.blockers}
            />
          )}
          {summary.warnings.length > 0 && (
            <IssueList
              title="Warnings"
              color={theme.color.amberText}
              items={summary.warnings}
            />
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
            <button
              onClick={onDownload}
              disabled={summary.blockers.length > 0}
              style={{
                ...primaryBtn,
                opacity: summary.blockers.length > 0 ? 0.5 : 1,
                cursor: summary.blockers.length > 0 ? "not-allowed" : "pointer",
              }}
              title={
                summary.blockers.length > 0
                  ? "Resolve the blockers above first"
                  : "Download the ICEGATE JSON file"
              }
            >
              <Download size={14} /> Generate ICEGATE JSON
            </button>
            <button onClick={() => setPreviewOpen((o) => !o)} style={secondaryBtn}>
              <FileJson size={13} /> {previewOpen ? "Hide" : "Show"} JSON
            </button>
            <span style={mono(10.5, theme.color.slate)}>{igmFileName(tree)}</span>
          </div>

          {previewOpen && (
            <pre
              style={{
                marginTop: 12,
                maxHeight: 340,
                overflow: "auto",
                background: "rgba(0,0,0,0.35)",
                border: `1px solid ${C.hair}`,
                borderRadius: theme.radius.sm,
                padding: 12,
                ...mono(11, theme.color.inkSoft),
                lineHeight: 1.6,
              }}
            >
              {JSON.stringify(generateIgmJson(tree), null, 2)}
            </pre>
          )}
        </>
      )}
    </Section>
  );
}

function Stat({ label, value }) {
  return (
    <div
      style={{
        border: `1px solid ${C.hair}`,
        borderRadius: theme.radius.sm,
        padding: "10px 12px",
      }}
    >
      <div style={{ ...mono(9, theme.color.slate), letterSpacing: "0.16em", textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ ...mono(16, theme.color.ink), marginTop: 5 }}>{value}</div>
    </div>
  );
}

function IssueList({ title, color, items }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ ...mono(9.5, color), letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
        {title} ({items.length})
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, ...mono(11.5, theme.color.inkSoft), lineHeight: 1.8 }}>
        {items.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </div>
  );
}
