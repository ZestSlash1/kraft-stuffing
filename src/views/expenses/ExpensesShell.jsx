import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { theme } from "../../theme";
import ExportMenu from "../../components/ExportMenu";
import { exportExpensesXlsx } from "../../lib/exportXlsx";
import ExpenseSummaryStrip from "../../components/expenses/ExpenseSummaryStrip";
import ExpenseFilters from "../../components/expenses/ExpenseFilters";
import ExpenseForm from "../../components/expenses/ExpenseForm";
import ExpenseListView from "./ExpenseListView";
import ExpenseSummaryView from "./ExpenseSummaryView";
import ExpenseDetailView from "./ExpenseDetailView";
import {
  KRAFT_ORG_ID,
  fetchExpenses,
  createExpense,
  updateExpense as dbUpdateExpense,
  deleteExpense as dbDeleteExpense,
  fromDbExpense,
  toDbExpense,
  toDbExpensePatch,
} from "../../lib/db";

// ─────────────────────────────────────────────────────────────────────────────
// ExpensesShell — top-level Expenses section. Offline-first like the rest of
// the app: cached rows render instantly, live Supabase data replaces them once
// the fetch resolves, and writes go through lib/db.js's offline queue (createLine
// / updateContainer use the same runWrite/executors machinery).
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_KEY = "kraft-expenses-cache-v1";

const readCache = () => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) || [];
  } catch {
    return [];
  }
};

const writeCache = (rows) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(rows));
  } catch {
    // storage full / unavailable — nothing we can do
  }
};

const uid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10);

// Local-time month key "YYYY-MM". Built from local components (not toISOString,
// which shifts to UTC and can roll the month back near a boundary in +0530).
const monthKey = (offset = 0) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function ExpensesShell({ app }) {
  const [expenses, setExpenses] = useState(readCache);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(null);
  const [tab, setTab] = useState("ledger"); // 'ledger' | 'summary'
  const [period, setPeriod] = useState("this-month");
  const [category, setCategory] = useState(null);
  const [adding, setAdding] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const userId = app?.user?.id;
  const voyages = app?.state?.voyages || [];

  const load = useCallback(() => {
    fetchExpenses(KRAFT_ORG_ID)
      .then(({ data, error }) => {
        if (error) {
          setSyncError({ thunk: load });
          return;
        }
        const rows = (data || []).map(fromDbExpense);
        setExpenses(rows);
        writeCache(rows);
        setSyncError(null);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Fire-and-forget write — surfaces a retryable banner on failure, matching
  // the App.jsx `sync()` convention used for voyages/containers/lines.
  const sync = (thunk) => {
    Promise.resolve(thunk()).then((res) => {
      if (res?.error) setSyncError({ thunk: () => sync(thunk) });
      else setSyncError(null);
    });
  };

  const filtered = useMemo(() => {
    const thisMonth = monthKey(0);
    const lastMonth = monthKey(-1);
    return expenses.filter((e) => {
      if (category && e.category !== category) return false;
      if (period === "this-month") return e.expenseDate.startsWith(thisMonth);
      if (period === "last-month") return e.expenseDate.startsWith(lastMonth);
      return true;
    });
  }, [expenses, period, category]);

  const selected = expenses.find((e) => e.id === selectedId) || null;

  const setAndCache = (updater) =>
    setExpenses((rows) => {
      const next = updater(rows);
      writeCache(next);
      return next;
    });

  const addExpense = (data) => {
    const row = { ...data, id: uid(), orgId: KRAFT_ORG_ID, loggedBy: userId };
    setAndCache((rows) => [row, ...rows]);
    setAdding(false);
    sync(() => createExpense(toDbExpense(row)));
  };

  const saveExpense = (data) => {
    setAndCache((rows) => rows.map((e) => (e.id === data.id ? { ...e, ...data } : e)));
    const { id, ...patch } = data;
    sync(() => dbUpdateExpense(id, toDbExpensePatch(patch)));
  };

  const deleteExpense = (id) => {
    setAndCache((rows) => rows.filter((e) => e.id !== id));
    setSelectedId(null);
    sync(() => dbDeleteExpense(id));
  };

  return (
    <div
      style={{
        minHeight: "100%",
        background: theme.color.canvas,
        color: theme.color.ink,
      }}
    >
      {syncError && (
        <div
          onClick={() => {
            const { thunk } = syncError;
            setSyncError(null);
            thunk?.();
          }}
          style={{
            background: theme.color.surface,
            borderBottom: `1px solid ${theme.color.red}`,
            color: theme.color.red,
            fontFamily: theme.font.mono,
            fontSize: 11,
            letterSpacing: "0.04em",
            textAlign: "center",
            padding: "8px 12px",
            cursor: "pointer",
          }}
        >
          Sync error — working offline. Tap to retry.
        </div>
      )}

      <div
        style={{
          maxWidth: 1040,
          width: "100%",
          margin: "0 auto",
          padding: "24px 28px 48px",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: theme.font.condensed,
                fontWeight: 800,
                fontSize: 34,
                letterSpacing: "0.02em",
                lineHeight: 1,
                color: theme.color.ink,
              }}
            >
              EXPENSES
            </div>
            <div
              style={{
                marginTop: 4,
                fontFamily: theme.font.mono,
                fontSize: 9,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: theme.color.slate,
              }}
            >
              Kraft Shipping &amp; Logistics
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <ExportMenu onExportXlsx={() => exportExpensesXlsx(filtered, app?.profilesById)} />
            <button
              onClick={() => setAdding((v) => !v)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: adding ? theme.color.surface : theme.color.amber,
                color: adding ? theme.color.inkSoft : theme.color.white,
                border: `1px solid ${adding ? theme.color.borderStrong : theme.color.amber}`,
                borderRadius: theme.radius.input,
                padding: "10px 16px",
                minHeight: 44,
                fontFamily: theme.font.condensed,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                cursor: "pointer",
              }}
            >
              <Plus size={16} /> {adding ? "Close" : "New expense"}
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <ExpenseSummaryStrip expenses={filtered} />

        {/* Add form drawer */}
        {adding && <ExpenseForm onSubmit={addExpense} voyages={voyages} />}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 22, borderBottom: `1px solid ${theme.color.border}` }}>
          {[
            ["ledger", "Ledger"],
            ["summary", "Summary"],
          ].map(([id, label]) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: `2px solid ${active ? theme.color.amber : "transparent"}`,
                  color: active ? theme.color.ink : theme.color.slate,
                  padding: "4px 2px 10px",
                  marginBottom: -1,
                  fontFamily: theme.font.condensed,
                  fontWeight: 700,
                  fontSize: 16,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <ExpenseFilters
          period={period}
          onPeriod={setPeriod}
          category={category}
          onCategory={setCategory}
        />

        {/* Body */}
        {loading && expenses.length === 0 ? (
          <ExpensesSkeleton />
        ) : tab === "ledger" ? (
          <ExpenseListView
            expenses={filtered}
            selectedId={selectedId}
            onSelect={(e) => setSelectedId(e.id)}
          />
        ) : (
          <ExpenseSummaryView expenses={filtered} />
        )}
      </div>

      {selected && (
        <ExpenseDetailView
          expense={selected}
          profilesById={app?.profilesById}
          onClose={() => setSelectedId(null)}
          onSave={saveExpense}
          onDelete={deleteExpense}
        />
      )}
    </div>
  );
}

// Three shimmer rows while the initial fetch is in flight and no cache exists.
function ExpensesSkeleton() {
  return (
    <div
      style={{
        background: theme.color.surface,
        border: `1px solid ${theme.color.border}`,
        borderRadius: theme.radius.card,
        boxShadow: theme.shadow.card,
        overflow: "hidden",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            padding: "12px 16px",
            borderBottom: i < 2 ? `1px solid ${theme.color.border}` : "none",
          }}
        >
          <div className="skeleton" style={{ width: 32, height: 12 }} />
          <div className="skeleton" style={{ flex: 1, height: 14, maxWidth: "60%" }} />
          <div className="skeleton" style={{ width: 70, height: 14 }} />
        </div>
      ))}
    </div>
  );
}
