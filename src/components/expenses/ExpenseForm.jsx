import { useState, useEffect } from "react";
import { theme } from "../../theme";
import { Input, Pill } from "../ui";
import { CATEGORIES, categoryType } from "../../views/expenses/expenseHelpers";

// ExpenseForm — add/edit an expense. No <form> tag (CLAUDE.md convention): plain
// divs + an onClick submit. Amounts entered in rupees, emitted as integer paise.
// `initial` pre-fills for edit mode; absence means a fresh "add".
const today = () => new Date().toISOString().split("T")[0];

const labelStyle = {
  fontFamily: theme.font.mono,
  fontSize: 9,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: theme.color.slate,
  marginBottom: 4,
  display: "block",
};

export default function ExpenseForm({
  initial,
  onSubmit,
  submitLabel = "Log expense",
  voyages = [],
  initialVoyageId = "",
}) {
  const [date, setDate] = useState(initial?.expenseDate || today());
  const [description, setDescription] = useState(initial?.description || "");
  const [amountRs, setAmountRs] = useState(
    initial ? String(Number(initial.amount) / 100) : ""
  );
  const [category, setCategory] = useState(initial?.category || CATEGORIES[0].name);
  const [type, setType] = useState(initial?.type || "expense");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [voyageId, setVoyageId] = useState(initial?.voyageId || initialVoyageId || "");

  // Keep type coherent with the chosen category (income categories flip the toggle).
  useEffect(() => {
    setType(categoryType(category));
  }, [category]);

  const valid = description.trim() && Number(amountRs) > 0 && date;

  const submit = () => {
    if (!valid) return;
    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      ...(initial?.referenceNo ? { referenceNo: initial.referenceNo } : {}),
      expenseDate: date,
      description: description.trim(),
      amount: Math.round(Number(amountRs) * 100), // → integer paise
      category,
      type,
      notes: notes.trim(),
      voyageId: voyageId || null,
    });
  };

  const ToggleBtn = ({ value, label, color }) => {
    const active = type === value;
    return (
      <button
        onClick={() => setType(value)}
        style={{
          flex: 1,
          background: active ? color : theme.color.surface,
          border: `1px solid ${active ? color : theme.color.borderStrong}`,
          color: active ? theme.color.white : theme.color.inkSoft,
          borderRadius: theme.radius.input,
          padding: "10px 0",
          minHeight: 44,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 14,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          cursor: "pointer",
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadow.card,
        padding: 20,
      }}
    >
      {/* Type toggle */}
      <div style={{ display: "flex", gap: 10 }}>
        <ToggleBtn value="expense" label="Expense" color={theme.color.red} />
        <ToggleBtn value="income" label="Income" color={theme.color.green} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
        <Input
          label="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: 150 }}
        />
        <Input
          label="amount (₹)"
          type="number"
          placeholder="0"
          value={amountRs}
          onChange={(e) => setAmountRs(e.target.value)}
          style={{ width: 130 }}
        />
        <div>
          <label style={labelStyle}>category</label>
          <Pill
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={CATEGORIES.map((c) => c.name)}
          />
        </div>
        {voyages.length > 0 && (
          <div>
            <label style={labelStyle}>link to voyage (optional)</label>
            <Pill
              value={voyageId}
              onChange={(e) => setVoyageId(e.target.value)}
              options={[
                { value: "", label: "None" },
                ...voyages.map((v) => ({ value: v.id, label: `${v.vessel} · ${v.voyageNo}` })),
              ]}
            />
          </div>
        )}
      </div>

      <Input
        label="description"
        placeholder="What was this for?"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
      />

      <div>
        <label style={labelStyle}>notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          style={{
            width: "100%",
            background: theme.color.surface,
            border: `1px solid ${theme.color.borderStrong}`,
            color: theme.color.ink,
            borderRadius: theme.radius.input,
            padding: "9px 12px",
            fontFamily: theme.font.mono,
            fontSize: 13,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />
      </div>

      <button
        onClick={submit}
        disabled={!valid}
        style={{
          background: valid ? theme.color.amber : theme.color.surfaceMuted,
          color: valid ? theme.color.white : theme.color.slateFaint,
          border: "none",
          borderRadius: theme.radius.input,
          padding: "13px 0",
          minHeight: 48,
          fontFamily: theme.font.condensed,
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          cursor: valid ? "pointer" : "not-allowed",
        }}
      >
        {submitLabel}
      </button>
    </div>
  );
}
