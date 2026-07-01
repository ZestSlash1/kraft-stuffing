-- Phase 6: Voyage P&L
-- The `expenses` table already carries `voyage_id uuid references voyages(id)`
-- (added in 0006_expenses.sql), so tagging an income/expense row to a voyage
-- needs no new column. All that's missing is an index to keep the per-voyage
-- roll-up cheap once the ledger grows.
--
-- No RPC: revenue/cost/margin are computed client-side from the already-loaded,
-- org-scoped `expenses` array (see src/views/expenses/expenseHelpers.js →
-- voyagePnlRows). Keeping the math on the client preserves the app's
-- offline-first behaviour — the P&L tab works from cache with no round-trip,
-- consistent with ExpenseSummaryView.

create index if not exists idx_expenses_voyage on expenses (voyage_id);
