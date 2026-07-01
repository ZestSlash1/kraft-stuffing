import * as XLSX from "xlsx";
import { containerStatus } from "../data/statusHelpers";
import { untaggedPnl, voyagePnlRows } from "../views/expenses/expenseHelpers";

const lineTotalKg = (l) => Number(l.qty || 0) * Number(l.unitWeightKg || 0);

const profileName = (profilesById, id) => (id && profilesById[id]) || (id ? id.slice(0, 8) : "—");

// ── Sheet 1: Stuffing Lines ───────────────────────────────────────────────────
function buildStuffingRows(voyage, profilesById) {
  const rows = [];
  voyage.containers.forEach((c) => {
    const status = containerStatus(c);
    if (c.lines.length === 0) {
      rows.push({
        Container: c.number || "Unassigned",
        Size: c.size,
        Status: status,
        Seal: c.sealNo,
        Cargo: "",
        Bags: "",
        UnitKg: "",
        TotalKg: "",
        Shipper: "",
        Consignee: "",
        "Truck No": "",
        Unit: "",
        "Invoice Nos": "",
        "Invoice Value": "",
        Currency: "",
        "HS Code": "",
        "E-Way Bill": "",
        "CHA Ref": "",
        "Notify Party": "",
        "Logged By": "",
        "Logged At (IST)": "",
      });
      return;
    }
    c.lines.forEach((l) => {
      rows.push({
        Container: c.number || "Unassigned",
        Size: c.size,
        Status: status,
        Seal: c.sealNo,
        Cargo: l.cargo,
        Bags: l.qty,
        UnitKg: l.unitWeightKg,
        TotalKg: lineTotalKg(l),
        Shipper: l.shipper,
        Consignee: l.consignee,
        "Truck No": l.truckNo,
        Unit: l.unit || "Bags",
        "Invoice Nos": (l.invoiceNos || []).join("|"),
        "Invoice Value": l.invoiceValue ?? "",
        Currency: l.invoiceCurrency || "",
        "HS Code": l.hsCode || "",
        "E-Way Bill": l.ewayBillNo || "",
        "CHA Ref": l.chaRef || "",
        "Notify Party": l.notifyParty || "",
        "Logged By": profileName(profilesById, l.loggedBy),
        "Logged At (IST)": l.loggedAt
          ? new Intl.DateTimeFormat("en-IN", {
              timeZone: "Asia/Kolkata",
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            }).format(new Date(l.loggedAt))
          : "",
      });
    });
  });
  return rows;
}

// ── Sheet 2: Containers ───────────────────────────────────────────────────────
function buildContainerRows(voyage, profilesById) {
  return voyage.containers.map((c) => {
    const netKg = c.lines.reduce((a, l) => a + lineTotalKg(l), 0);
    const tareKg = Number(c.tareWeightKg || 0);
    const grossKg = netKg + tareKg;
    const stuffedBy = [
      ...new Set(c.lines.map((l) => profileName(profilesById, l.loggedBy)).filter(Boolean)),
    ].join(", ");
    return {
      "Container No": c.number || "Unassigned",
      Size: c.size,
      "Tare (kg)": tareKg,
      "Net Wt (kg)": netKg,
      "Gross Wt (kg)": grossKg,
      "VGM (kg)": grossKg,
      "CML (kg)": c.cmlKg ?? "",
      "Seal No": c.sealNo || "",
      "Seal No 2": c.sealNo2 || "",
      Condition: c.condition || "Clean",
      "Sealed At": c.sealedAt
        ? new Intl.DateTimeFormat("en-IN", {
            timeZone: "Asia/Kolkata",
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(new Date(c.sealedAt))
        : "",
      "Stuffed By": stuffedBy,
    };
  });
}

// ── Sheet 3: Voyage Summary ───────────────────────────────────────────────────
function buildVoyageSummaryRow(voyage) {
  const totalBags = voyage.containers.reduce(
    (a, c) => a + c.lines.reduce((aa, l) => aa + Number(l.qty || 0), 0),
    0
  );
  const netKg = voyage.containers.reduce(
    (a, c) => a + c.lines.reduce((aa, l) => aa + lineTotalKg(l), 0),
    0
  );
  const sealed = voyage.containers.filter((c) => c.sealed).length;
  return [
    {
      "Voyage No": voyage.voyageNo || "",
      Vessel: voyage.vessel || "",
      Date: voyage.date || "",
      POL: voyage.pol || "",
      POD: voyage.pod || "",
      ETD: voyage.etd || "",
      "Shipping Line": voyage.shippingLine || "",
      IMO: voyage.imoNo || "",
      "Booking Ref": voyage.bookingRef || "",
      "BL No": voyage.blNo || "",
      CHA: voyage.chaName || "",
      "Total Containers": voyage.containers.length,
      Sealed: sealed,
      "Total Bags": totalBags,
      "Net MT": Number((netKg / 1000).toFixed(2)),
    },
  ];
}

export function exportVoyageXlsx(voyage, profilesById = {}) {
  if (!voyage) return;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildStuffingRows(voyage, profilesById)),
    "Stuffing Lines"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildContainerRows(voyage, profilesById)),
    "Containers"
  );
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildVoyageSummaryRow(voyage)),
    "Voyage Summary"
  );

  XLSX.writeFile(wb, `${voyage.voyageNo || "voyage"}-stuffing-log.xlsx`);
}

// ── Expenses ────────────────────────────────────────────────────────────────
function buildExpenseRows(expenses, profilesById) {
  return expenses.map((e) => ({
    Date: e.expenseDate,
    Type: e.type === "income" ? "Income" : "Expense",
    Category: e.category,
    Description: e.description,
    "Amount (₹)": Number((Number(e.amount || 0) / 100).toFixed(2)),
    Currency: e.currency || "INR",
    Reference: e.referenceNo || "",
    Notes: e.notes || "",
    "Logged By": profileName(profilesById, e.loggedBy),
  }));
}

// ── Sheet 2: Voyage P&L roll-up (Phase 6) ─────────────────────────────────────
// Revenue = income rows tagged to a voyage, cost = expense rows, margin = the
// difference. Amounts are integer paise → divided to rupees at the edge, like
// buildExpenseRows. `allExpenses` is the full (unfiltered) org set so the P&L is
// complete regardless of the ledger's active period/category filters.
function buildVoyagePnlRows(allExpenses, voyages) {
  const rows = voyagePnlRows(allExpenses, voyages);
  const out = rows.map((r) => ({
    Voyage: r.label,
    "Revenue (₹)": Number((r.revenue / 100).toFixed(2)),
    "Cost (₹)": Number((r.cost / 100).toFixed(2)),
    "Margin (₹)": Number((r.margin / 100).toFixed(2)),
    "Margin %": r.marginPct == null ? "—" : Number(r.marginPct.toFixed(1)),
  }));
  const untagged = untaggedPnl(allExpenses);
  if (untagged) {
    out.push({
      Voyage: "Untagged (overhead)",
      "Revenue (₹)": Number((untagged.revenue / 100).toFixed(2)),
      "Cost (₹)": Number((untagged.cost / 100).toFixed(2)),
      "Margin (₹)": Number((untagged.margin / 100).toFixed(2)),
      "Margin %": untagged.marginPct == null ? "—" : Number(untagged.marginPct.toFixed(1)),
    });
  }
  return out;
}

export function exportExpensesXlsx(expenses, profilesById = {}, pnl = null) {
  if (!expenses?.length) return;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(buildExpenseRows(expenses, profilesById)),
    "Expenses"
  );

  // Optional Voyage P&L sheet — only when there's tagged data to roll up.
  if (pnl?.voyages?.length && pnl?.expenses?.length) {
    const pnlRows = buildVoyagePnlRows(pnl.expenses, pnl.voyages);
    if (pnlRows.length) {
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(pnlRows),
        "Voyage P&L"
      );
    }
  }

  const stamp = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(new Date())
    .replace(/\s+/g, "-");

  XLSX.writeFile(wb, `expenses-${stamp}.xlsx`);
}
