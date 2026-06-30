import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { X } from "lucide-react";
import { theme } from "../../theme";
import { SpecLabel } from "../../components/ui";
import CategoryBadge from "../../components/expenses/CategoryBadge";
import ExpenseForm from "../../components/expenses/ExpenseForm";
import { fmtPaise, fmtDateHeader } from "./expenseHelpers";
import { fetchAuditLog, fromDbAuditEntry } from "../../lib/db";

function diffFields(oldData, newData) {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out = [];
  for (const k of keys) {
    const before = oldData[k];
    const after = newData[k];
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      out.push([k, before ?? "—", after ?? "—"]);
    }
  }
  return out;
}

function AuditTab({ expenseId, profilesById }) {
  const [entries, setEntries] = useState(null);

  useEffect(() => {
    if (!expenseId) return;
    let cancelled = false;
    fetchAuditLog([expenseId]).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        console.warn("[audit] fetch failed:", error.message);
        setEntries([]);
        return;
      }
      setEntries((data || []).map(fromDbAuditEntry));
    });
    return () => {
      cancelled = true;
    };
  }, [expenseId]);

  if (entries === null) return <div className="label-xs">loading…</div>;
  if (entries.length === 0) return <div className="label-xs">No audit entries yet.</div>;

  return (
    <div>
      {entries.map((e) => {
        const who = (profilesById && profilesById[e.changedBy]) || e.changedBy?.slice(0, 8) || "—";
        const diffs = e.action === "UPDATE" ? diffFields(e.oldData, e.newData) : [];
        return (
          <div
            key={e.id}
            style={{ padding: "10px 0", borderBottom: `1px solid ${theme.color.border}` }}
          >
            <div style={{ fontSize: 12 }}>
              {e.action} by {who} — {new Date(e.changedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
            </div>
            {diffs.length > 0 && (
              <div style={{ marginLeft: 14, marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                {diffs.map(([k, before, after]) => (
                  <span key={k} style={{ fontSize: 11, color: theme.color.slate }}>
                    {k}: {String(before)} → {String(after)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ExpenseDetailView — a slide-up panel for a single expense. Read view by default
// with edit + delete actions; flips to an inline ExpenseForm when editing. Esc and
// the backdrop both close it.
export default function ExpenseDetailView({ expense, profilesById, onClose, onSave, onDelete }) {
  const panelRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState("details");

  useEffect(() => {
    if (
      panelRef.current &&
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      gsap.from(panelRef.current, { y: "100%", duration: 0.4, ease: "power3.out" });
    }
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setTab("details");
    setEditing(false);
  }, [expense?.id]);

  if (!expense) return null;
  const income = expense.type === "income";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        background: "rgba(15,23,42,.35)",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "88vh",
          overflowY: "auto",
          background: theme.color.surface,
          borderTopLeftRadius: theme.radius.card,
          borderTopRightRadius: theme.radius.card,
          border: `1px solid ${theme.color.border}`,
          boxShadow: theme.shadow.raised,
          padding: "22px 24px 28px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 18,
          }}
        >
          <span
            style={{
              fontFamily: theme.font.mono,
              fontSize: 10,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: theme.color.slate,
            }}
          >
            {editing ? "Edit expense" : "Expense detail"}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: theme.color.slate,
              padding: 4,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {editing ? (
          <ExpenseForm
            initial={expense}
            submitLabel="Save changes"
            onSubmit={(data) => {
              onSave(data);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <div
              style={{
                fontFamily: theme.font.condensed,
                fontWeight: 800,
                fontSize: 30,
                lineHeight: 1.05,
                color: theme.color.ink,
              }}
            >
              {expense.description}
            </div>
            <div
              style={{
                fontFamily: theme.font.condensed,
                fontWeight: 700,
                fontSize: 38,
                marginTop: 8,
                color: income ? theme.color.green : theme.color.red,
              }}
            >
              <span style={{ color: theme.color.slate, fontWeight: 400 }}>
                {income ? "+₹" : "−₹"}
              </span>
              {fmtPaise(expense.amount)}
            </div>

            <div style={{ marginTop: 16 }}>
              <CategoryBadge category={expense.category} type={expense.type} />
            </div>

            <div
              style={{
                display: "flex",
                gap: 18,
                marginTop: 22,
                borderBottom: `1px solid ${theme.color.border}`,
              }}
            >
              {["details", "audit"].map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="mono"
                  style={{
                    background: "none",
                    border: "none",
                    color: tab === t ? theme.color.ink : theme.color.slate,
                    fontFamily: theme.font.condensed,
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    padding: "0 0 10px",
                    minHeight: 44,
                    cursor: "pointer",
                    borderBottom: tab === t ? `2px solid ${theme.color.amber}` : "2px solid transparent",
                  }}
                >
                  {t === "details" ? "Details" : "Audit"}
                </button>
              ))}
            </div>

            {tab === "audit" ? (
              <div style={{ marginTop: 16 }}>
                <AuditTab expenseId={expense.id} profilesById={profilesById} />
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginTop: 20,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 20,
                  }}
                >
                  <SpecLabel label="Date" value={fmtDateHeader(expense.expenseDate)} />
                  <SpecLabel
                    label="Reference"
                    value={expense.referenceNo || "—"}
                  />
                  <SpecLabel
                    label="Type"
                    value={income ? "Income" : "Expense"}
                    tone={income ? "ok" : undefined}
                  />
                </div>

                {expense.notes && (
                  <div style={{ marginTop: 20 }}>
                    <SpecLabel label="Notes" value={expense.notes} />
                  </div>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setEditing(true)}
                style={{
                  flex: 1,
                  background: theme.color.amber,
                  color: theme.color.white,
                  border: "none",
                  borderRadius: theme.radius.input,
                  padding: "12px 0",
                  minHeight: 46,
                  fontFamily: theme.font.condensed,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Edit
              </button>
              <button
                onClick={() => onDelete(expense.id)}
                style={{
                  flex: "0 0 auto",
                  background: theme.color.surface,
                  color: theme.color.red,
                  border: `1px solid ${theme.color.borderStrong}`,
                  borderRadius: theme.radius.input,
                  padding: "12px 22px",
                  minHeight: 46,
                  fontFamily: theme.font.condensed,
                  fontWeight: 700,
                  fontSize: 14,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
