import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Trash2, X } from "lucide-react";
import { theme } from "../theme";
import { C, F, glass } from "../ui/theme";
import { Input, Pill } from "../components/ui";
import { useToast } from "../components/Toast";
import AttachmentsPanel from "../components/AttachmentsPanel";
import { useRouter } from "../context/RouterContext";
import { useIsMobile } from "../hooks/useIsMobile";
import {
  groupByCargoType,
  containerCountSummary,
  formatPackageLines,
  nextSlNo,
} from "../data/cartingOrderHelpers";
import { formatKg2, formatRupees2, formatDDMMYY } from "../lib/format";
import {
  fetchCartingOrder,
  updateCartingOrder,
  addCartingContainer,
  deleteCartingContainer,
  issueCartingOrder,
} from "../lib/cartingOrders";
import {
  buildCartingOrderPayload,
  generateCartingOrderPdf,
  loadKraftLogo,
} from "../lib/pdf/cartingOrder";

const SIZES = ["20", "40", "40HC", "45"];

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

// A local working row carries a client-side `key`; DB ids are re-minted on save
// (drafts are re-persisted wholesale, so we never diff individual rows).
const emptyRow = (voyageContainers, slNo) => ({
  key: uid(),
  slNo,
  containerNo: "",
  sizeType: "20",
  cargoGrWtKgs: 0,
  tareWtKgs: 0,
  vgmWtKgs: 0,
  cargoType: "",
  valueRupees: 0,
  packageLines: [{ qty: "", unit: "" }],
});

export default function CartingOrderDetailView({ app, orderId, voyageId }) {
  const { state, user } = app;
  const { navigate, setDirty } = useRouter();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const voyage =
    state.voyages.find((v) => v.id === voyageId) ||
    state.voyages.find((v) => v.containers) ||
    null;

  const [order, setOrder] = useState(null); // loaded draft
  const [fields, setFields] = useState(null); // editable order-level fields
  const [rows, setRows] = useState([]); // working container lines
  const [savedIds, setSavedIds] = useState([]); // persisted container ids to clear on save
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [addOpen, setAddOpen] = useState(false);

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

  useEffect(() => {
    let cancelled = false;
    fetchCartingOrder(orderId).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        showToast("Could not load carting order", "error");
        navigate("carting");
        return;
      }
      setOrder(data);
      setFields({
        orderDate: data.orderDate || new Date().toISOString().slice(0, 10),
        pol: data.pol || "",
        pod: data.pod || "",
        rotationNo: data.rotationNo || "",
        rotationDate: data.rotationDate || "",
        vcn: data.vcn || "",
        bookingNo: data.bookingNo || voyage?.bookingRef || "",
        tillText: data.tillText || "Till Finish",
      });
      setRows(
        (data.containers || []).map((c) => ({
          key: uid(),
          slNo: c.slNo,
          containerNo: c.containerNo,
          sizeType: c.sizeType,
          cargoGrWtKgs: c.cargoGrWtKgs,
          tareWtKgs: c.tareWtKgs,
          vgmWtKgs: c.vgmWtKgs,
          cargoType: c.cargoType,
          valueRupees: Number(c.valuePaise || 0) / 100,
          packageLines: (c.packageLines || []).length
            ? c.packageLines.map((l) => ({ qty: l.qty, unit: l.unit }))
            : [{ qty: "", unit: "" }],
        }))
      );
      setSavedIds((data.containers || []).map((c) => c.id));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const markDirty = () => setDirty?.(true);

  const setField = (k) => (v) => {
    setFields((f) => ({ ...f, [k]: v }));
    markDirty();
  };

  // ── Container lines held as app-shaped objects for the aggregation helpers ────
  const asContainers = useMemo(
    () =>
      rows.map((r) => ({
        slNo: r.slNo,
        containerNo: r.containerNo,
        sizeType: r.sizeType,
        cargoGrWtKgs: Number(r.cargoGrWtKgs || 0),
        tareWtKgs: Number(r.tareWtKgs || 0),
        vgmWtKgs: Number(r.vgmWtKgs || 0),
        cargoType: r.cargoType,
        valuePaise: Math.round(Number(r.valueRupees || 0) * 100),
        packageLines: (r.packageLines || [])
          .map((l) => ({ qty: Number(l.qty || 0), unit: (l.unit || "").trim() }))
          .filter((l) => l.qty || l.unit),
      })),
    [rows]
  );

  const groups = useMemo(() => groupByCargoType(asContainers), [asContainers]);
  const countSummary = useMemo(() => containerCountSummary(asContainers), [asContainers]);

  const addRow = (row) => {
    setRows((rs) => [...rs, { ...row, slNo: nextSlNo(rs) }]);
    markDirty();
  };

  const removeRow = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key).map((r, i) => ({ ...r, slNo: i + 1 })));
    markDirty();
  };

  // Re-persist the draft wholesale: update order fields, clear the previously
  // saved container rows (hard delete is allowed on drafts), re-insert current.
  const persistDraft = async () => {
    const { error: uErr } = await updateCartingOrder(order.id, fields);
    if (uErr) return { error: uErr };
    for (const id of savedIds) {
      const { error } = await deleteCartingContainer(id);
      if (error) return { error };
    }
    const newIds = [];
    for (let i = 0; i < asContainers.length; i++) {
      const c = asContainers[i];
      const { data, error } = await addCartingContainer({
        cartingOrderId: order.id,
        slNo: i + 1,
        containerNo: c.containerNo,
        sizeType: c.sizeType,
        cargoGrWtKgs: c.cargoGrWtKgs,
        tareWtKgs: c.tareWtKgs,
        vgmWtKgs: c.vgmWtKgs,
        cargoType: c.cargoType,
        valuePaise: c.valuePaise,
        packageLines: c.packageLines,
      });
      if (error) return { error };
      if (data) newIds.push(data.id);
    }
    setSavedIds(newIds);
    return { error: null };
  };

  const onSave = async () => {
    if (busy || !order) return;
    setBusy(true);
    const { error } = await persistDraft();
    setBusy(false);
    if (error) {
      showToast(`Save failed: ${error.message}`, "error");
      return;
    }
    setDirty?.(false);
    showToast("Draft saved", "success");
  };

  const payload = useMemo(() => {
    if (!order || !fields) return null;
    return buildCartingOrderPayload({ ...order, ...fields }, voyage, asContainers);
  }, [order, fields, voyage, asContainers]);

  // Issue: persist, freeze snapshot + upload PDF, then run the chosen action on
  // the generated blob (view / print / share). Issuing is one-way and one-time.
  const onIssue = async (action) => {
    if (busy || !order || !payload) return;
    if (!asContainers.length) {
      showToast("Add at least one container first", "error");
      return;
    }
    if (!online) {
      showToast("Issuing a carting order requires a live connection", "error");
      return;
    }
    setBusy(true);
    const { error: pErr } = await persistDraft();
    if (pErr) {
      setBusy(false);
      showToast(`Save failed: ${pErr.message}`, "error");
      return;
    }
    const logoDataUrl = await loadKraftLogo();
    const blob = generateCartingOrderPdf(payload, {
      issuedAt: new Date().toISOString(),
      logoDataUrl,
    });
    const { data, error } = await issueCartingOrder(order.id, {
      snapshot: payload,
      pdfBlob: blob,
      issuedBy: user?.id,
    });
    setBusy(false);
    if (error || !data) {
      showToast(`Issue failed: ${error?.message || "unknown"}`, "error");
      return;
    }
    setDirty?.(false);
    runAction(action, blob, data.snapshot?.number || "carting-order");
    showToast(`Carting order issued — ${data.snapshot?.number || ""}`, "success");
    navigate("carting", { voyageId });
  };

  const runAction = (action, blob, name) => {
    const url = URL.createObjectURL(blob);
    if (action === "print") {
      const frame = document.createElement("iframe");
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      frame.src = url;
      frame.onload = () => {
        frame.contentWindow?.focus();
        frame.contentWindow?.print();
      };
      document.body.appendChild(frame);
      return;
    }
    if (action === "share" && navigator.canShare) {
      const file = new File([blob], `${name.replace(/\//g, "_")}.pdf`, { type: "application/pdf" });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: "Export Carting Order" }).catch(() => {});
        return;
      }
    }
    if (action === "share") {
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/\//g, "_")}.pdf`;
      a.click();
      return;
    }
    // view
    window.open(url, "_blank", "noopener");
  };

  if (!order || !fields) {
    return (
      <div style={{ padding: 40, fontFamily: F.mono, fontSize: 12, color: theme.color.slate }}>
        Loading…
      </div>
    );
  }

  const readOnly = order.status !== "draft";

  return (
    <div style={{ minHeight: "100%", color: theme.color.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 48px" }}>
        {/* Header bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={() => navigate("carting", { voyageId })} style={backBtn} title="Back">
            <ArrowLeft size={16} />
          </button>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 24 }}>
            EXPORT CARTING ORDER
          </div>
          {readOnly && (
            <span style={{ fontFamily: F.mono, fontSize: 11, color: theme.color.green }}>ISSUED — read only</span>
          )}
        </div>

        {/* Read-only voyage header */}
        <div style={{ ...glass(theme.radius.card), padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 14 }}>
          <ReadField label="Vessel" value={voyage?.vessel || "—"} />
          <ReadField label="Voyage No" value={voyage?.voyageNo || "—"} />
          <ReadField label="Booking Ref" value={voyage?.bookingRef || "—"} />
          <ReadField label="Route" value={`${fields.pol || "—"} → ${fields.pod || "—"}`} />
        </div>

        {/* Editable order fields */}
        <div style={{ ...glass(theme.radius.card), padding: 16, marginBottom: 14, display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 12 }}>
          <Labeled label="Order date">
            <Input type="date" value={fields.orderDate} disabled={readOnly} onChange={(e) => setField("orderDate")(e.target.value)} />
          </Labeled>
          <Labeled label="Booking No">
            <Input value={fields.bookingNo} disabled={readOnly} onChange={(e) => setField("bookingNo")(e.target.value)} />
          </Labeled>
          <Labeled label="Rotation No">
            <Input value={fields.rotationNo} disabled={readOnly} onChange={(e) => setField("rotationNo")(e.target.value)} />
          </Labeled>
          <Labeled label="Rotation date">
            <Input type="date" value={fields.rotationDate || ""} disabled={readOnly} onChange={(e) => setField("rotationDate")(e.target.value)} />
          </Labeled>
          <Labeled label="VCN">
            <Input value={fields.vcn} disabled={readOnly} onChange={(e) => setField("vcn")(e.target.value)} />
          </Labeled>
          <Labeled label="Till">
            <Input value={fields.tillText} disabled={readOnly} onChange={(e) => setField("tillText")(e.target.value)} />
          </Labeled>
          <Labeled label="POL (override)">
            <Input value={fields.pol} disabled={readOnly} onChange={(e) => setField("pol")(e.target.value)} />
          </Labeled>
          <Labeled label="POD (override)">
            <Input value={fields.pod} disabled={readOnly} onChange={(e) => setField("pod")(e.target.value)} />
          </Labeled>
        </div>

        {/* Container table */}
        <div style={{ ...glass(theme.radius.card), overflow: "hidden", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: `1px solid ${C.hair}` }}>
            <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, letterSpacing: "0.04em" }}>CONTAINERS</div>
            {!readOnly && (
              <button onClick={() => setAddOpen(true)} style={addBtn}>
                <Plus size={14} /> Add container
              </button>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  {["Sl.No.", "Container Nos.", "Size/Type", "Cargo Gr. Wt.(KGS)", "Tare WT.(KGS)", "VGM WT(KGS)", ""].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ ...td, color: theme.color.slate, textAlign: "center", padding: 20 }}>
                      No containers added yet.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.key}>
                      <td style={td}>{r.slNo}</td>
                      <td style={td}>{r.containerNo || "—"}</td>
                      <td style={td}>{r.sizeType}</td>
                      <td style={{ ...td, textAlign: "right" }}>{formatKg2(r.cargoGrWtKgs)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{formatKg2(r.tareWtKgs)}</td>
                      <td style={{ ...td, textAlign: "right" }}>{formatKg2(r.vgmWtKgs)}</td>
                      <td style={{ ...td, textAlign: "right" }}>
                        {!readOnly && (
                          <button onClick={() => removeRow(r.key)} style={{ ...iconBtn, color: theme.color.red }} title="Remove">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live header preview */}
        <div style={{ ...glass(theme.radius.card), padding: 16, marginBottom: 14 }}>
          <div style={{ fontFamily: F.head, fontWeight: 700, fontSize: 15, letterSpacing: "0.04em", marginBottom: 10 }}>
            HEADER PREVIEW
          </div>
          {groups.length === 0 ? (
            <div style={{ fontFamily: F.mono, fontSize: 12, color: theme.color.slate }}>Add containers to see the summary.</div>
          ) : (
            <div style={{ fontFamily: F.mono, fontSize: 12.5, lineHeight: 1.7 }}>
              {groups.map((g, i) => (
                <div key={i} style={{ marginBottom: 8 }}>
                  <div>
                    Gr. WT.{formatKg2(g.grWtTotalKgs)} KGS
                    {formatPackageLines(g.packageLines) ? `, ${formatPackageLines(g.packageLines)}` : ""} CARGO: {g.cargoType || "—"}.
                  </div>
                  <div>VALUE : RS. {formatRupees2(g.valuePaiseTotal)}</div>
                </div>
              ))}
              <div style={{ marginTop: 10, color: theme.color.amberText }}>
                Please allow <b>{countSummary || "—"}</b>, house stuffed export containers per M.V. <b>{voyage?.vessel || "—"}</b> VOY No: {voyage?.voyageNo || "—"}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            <button onClick={onSave} disabled={busy} style={secondaryBtn}>Save draft</button>
            <div style={{ flex: 1 }} />
            {!online && (
              <span style={{ fontFamily: F.mono, fontSize: 10, color: theme.color.slate }}>Offline — issuing needs a connection</span>
            )}
            <button onClick={() => onIssue("view")} disabled={busy || !online} style={primaryBtn}>View</button>
            <button onClick={() => onIssue("print")} disabled={busy || !online} style={primaryBtn}>Print</button>
            <button onClick={() => onIssue("share")} disabled={busy || !online} style={primaryBtn}>Share</button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <AttachmentsPanel parentType="carting_order" parentId={order.id} createdBy={user?.id} />
        </div>
      </div>

      {addOpen && (
        <AddContainerModal
          voyage={voyage}
          slNo={nextSlNo(rows)}
          onClose={() => setAddOpen(false)}
          onAdd={(row) => {
            addRow(row);
            setAddOpen(false);
          }}
        />
      )}
    </div>
  );
}

// ── Add / edit a container line ────────────────────────────────────────────────
function AddContainerModal({ voyage, slNo, onClose, onAdd }) {
  const isMobile = useIsMobile();
  const [row, setRow] = useState(emptyRow(voyage?.containers, slNo));
  const set = (k) => (v) => setRow((r) => ({ ...r, [k]: v }));

  // Prefill size/gross/tare from an existing stuffing container with this number.
  const onContainerNo = (v) => {
    const match = (voyage?.containers || []).find(
      (c) => (c.number || "").trim().toUpperCase() === v.trim().toUpperCase()
    );
    setRow((r) => {
      if (!match) return { ...r, containerNo: v };
      const gross = (match.lines || []).reduce(
        (a, l) => a + Number(l.qty || 0) * Number(l.unitWeightKg || 0),
        0
      );
      return {
        ...r,
        containerNo: v,
        sizeType: match.size || r.sizeType,
        tareWtKgs: match.tareWeightKg || r.tareWtKgs,
        cargoGrWtKgs: gross || r.cargoGrWtKgs,
      };
    });
  };

  const setPkg = (i, k) => (v) =>
    setRow((r) => ({
      ...r,
      packageLines: r.packageLines.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)),
    }));
  const addPkg = () => setRow((r) => ({ ...r, packageLines: [...r.packageLines, { qty: "", unit: "" }] }));
  const removePkg = (i) =>
    setRow((r) => ({ ...r, packageLines: r.packageLines.filter((_, idx) => idx !== i) }));

  const canSave = row.containerNo.trim() && row.cargoType.trim();

  return (
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={{ ...modal, width: isMobile ? "100%" : 520 }}>
        <div style={modalHead}>
          <div style={{ fontFamily: F.head, fontWeight: 800, fontSize: 20 }}>Add container</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: theme.color.slate, cursor: "pointer" }}><X size={18} /></button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12, overflowY: "auto" }}>
          <Labeled label="Container No.">
            <Input value={row.containerNo} onChange={(e) => onContainerNo(e.target.value)} placeholder="ILCU 1002028" />
          </Labeled>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Labeled label="Size / Type">
              <Pill value={row.sizeType} onChange={(e) => set("sizeType")(e.target.value)} options={SIZES} style={{ width: "100%" }} />
            </Labeled>
            <Labeled label="Cargo Type">
              <Input value={row.cargoType} onChange={(e) => set("cargoType")(e.target.value)} placeholder="Plywood" />
            </Labeled>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Labeled label="Cargo Gr. Wt (KGS)">
              <Input type="number" value={row.cargoGrWtKgs} onChange={(e) => set("cargoGrWtKgs")(Number(e.target.value))} />
            </Labeled>
            <Labeled label="Tare WT (KGS)">
              <Input type="number" value={row.tareWtKgs} onChange={(e) => set("tareWtKgs")(Number(e.target.value))} />
            </Labeled>
            <Labeled label="VGM WT (KGS)">
              <Input type="number" value={row.vgmWtKgs} onChange={(e) => set("vgmWtKgs")(Number(e.target.value))} />
            </Labeled>
          </div>
          <Labeled label="Value (₹)">
            <Input type="number" value={row.valueRupees} onChange={(e) => set("valueRupees")(Number(e.target.value))} />
          </Labeled>

          <div>
            <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.color.slate, marginBottom: 6 }}>
              Package lines
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {row.packageLines.map((p, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Input type="number" value={p.qty} onChange={(e) => setPkg(i, "qty")(e.target.value)} placeholder="471" style={{ width: 90 }} />
                  <Input value={p.unit} onChange={(e) => setPkg(i, "unit")(e.target.value)} placeholder="PC" style={{ flex: 1 }} />
                  <button onClick={() => removePkg(i)} style={{ ...iconBtn, color: theme.color.red }}><Trash2 size={13} /></button>
                </div>
              ))}
              <button onClick={addPkg} style={{ ...addBtn, alignSelf: "flex-start" }}><Plus size={13} /> Add line</button>
            </div>
          </div>
        </div>
        <div style={{ padding: 16, borderTop: `1px solid ${C.hair}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={secondaryBtn}>Cancel</button>
          <button onClick={() => onAdd(row)} disabled={!canSave} style={{ ...primaryBtn, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "not-allowed" }}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Small presentational bits ─────────────────────────────────────────────────
function ReadField({ label, value }) {
  return (
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.color.slate, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: F.mono, fontSize: 13, color: theme.color.ink }}>{value}</div>
    </div>
  );
}

function Labeled({ label, children }) {
  return (
    <div>
      <div style={{ fontFamily: F.mono, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: theme.color.slate, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

const th = {
  textAlign: "left",
  fontFamily: F.mono,
  fontSize: 9,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: theme.color.slate,
  padding: "10px 12px",
  borderBottom: `1px solid ${C.hair}`,
  whiteSpace: "nowrap",
  position: "sticky",
  top: 0,
  background: "rgba(10,16,32,0.6)",
};
const td = { fontFamily: F.mono, fontSize: 12.5, color: theme.color.ink, padding: "10px 12px", borderBottom: `1px solid ${C.hair}` };

const backBtn = { display: "flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.hair}`, borderRadius: 999, color: C.inkDim, cursor: "pointer", flexShrink: 0 };
const iconBtn = { background: theme.color.surfaceMuted, border: `1px solid ${theme.color.border}`, color: theme.color.inkSoft, borderRadius: theme.radius.sm, padding: 6, cursor: "pointer", display: "flex" };
const addBtn = { display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: `1px solid ${C.hair}`, color: theme.color.inkSoft, borderRadius: theme.radius.sm, padding: "7px 12px", fontFamily: F.mono, fontSize: 11.5, cursor: "pointer" };
const primaryBtn = { background: theme.color.amber, border: "none", color: "#fff", fontFamily: F.head, fontWeight: 800, fontSize: 14, letterSpacing: "0.05em", textTransform: "uppercase", padding: "9px 18px", borderRadius: theme.radius.sm, cursor: "pointer" };
const secondaryBtn = { background: "rgba(255,255,255,0.06)", border: `1px solid ${C.hair}`, color: theme.color.ink, fontFamily: F.head, fontWeight: 700, fontSize: 14, letterSpacing: "0.04em", textTransform: "uppercase", padding: "9px 16px", borderRadius: theme.radius.sm, cursor: "pointer" };
const overlay = { position: "fixed", inset: 0, zIndex: 500, background: "rgba(2,4,7,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 };
const modal = { maxHeight: "90vh", display: "flex", flexDirection: "column", ...glass(theme.radius.card), overflow: "hidden" };
const modalHead = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: `1px solid ${C.hair}` };
