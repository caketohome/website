/**
 * CakeToHome ERP — Accounting & Operational Reports Export Utility
 * Phase 5A.6 Substep 5.5: Report & Export Architecture (5.5.2)
 *
 * READ-ONLY EXPORT & SERIALIZATION LAYER:
 * - Strictly serializes verified data from existing canonical services.
 * - ZERO client-side recalculation or alternate accounting logic.
 * - RFC-4180 compliant CSV encoding with UTF-8 BOM (\uFEFF) for Excel/Sheets.
 * - Print-friendly layout helpers for browser Save-to-PDF workflows.
 */

// ─── CSV HELPERS ─────────────────────────────────────────────────────────────

export function escapeCsvCell(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  const str = String(cell);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsvString(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvCell).join(","));
  return [headerLine, ...dataLines].join("\r\n");
}

export function triggerCsvDownload(csvString: string, filename: string): void {
  if (typeof window === "undefined") return;
  const safeFilename = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function triggerPrint(): void {
  if (typeof window !== "undefined") {
    window.print();
  }
}

// ─── FINANCIAL REPORT EXPORTS (Central Accounting) ───────────────────────────

export interface RetainedEarningsYearRollForward {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  is_closed: boolean;
  active_close_voucher_id: string | null;
  opening_retained_earnings: number;
  net_operating_profit: number;
  transferred_to_retained_earnings: number;
  drawings_transferred: number;
  reopen_reversals: number;
  closing_retained_earnings: number;
  continuity_verified: boolean;
}

export interface RetainedEarningsRollForwardExportData {
  start_year: string;
  end_year: string;
  branch_id: string | null;
  years: RetainedEarningsYearRollForward[];
  overall_continuity_verified: boolean;
  multi_year_continuity_intact?: boolean;
}

/**
 * Export Retained Earnings Roll-Forward Schedule (Account 3210) to RFC-4180 CSV
 */
export function exportRetainedEarningsRollForwardCsv(
  data: RetainedEarningsRollForwardExportData,
  branchLabel?: string
): void {
  const headers = [
    "Fiscal Year",
    "Status",
    "Start Date",
    "End Date",
    "Closing Voucher ID",
    "Opening Retained Earnings (INR)",
    "Net Operating Profit (INR)",
    "Transferred to RE (INR)",
    "Drawings Transferred (INR)",
    "Reopen Reversals (INR)",
    "Closing Retained Earnings (INR)",
    "Mathematical Continuity Verified",
  ];

  const rows = (data.years || []).map((y) => [
    y.fiscal_year,
    y.is_closed ? "CLOSED" : "OPEN",
    y.start_date,
    y.end_date,
    y.active_close_voucher_id || "N/A",
    Number(y.opening_retained_earnings || 0).toFixed(2),
    Number(y.net_operating_profit || 0).toFixed(2),
    Number(y.transferred_to_retained_earnings || 0).toFixed(2),
    Number(y.drawings_transferred || 0).toFixed(2),
    Number(y.reopen_reversals || 0).toFixed(2),
    Number(y.closing_retained_earnings || 0).toFixed(2),
    y.continuity_verified ? "YES" : "NO",
  ]);

  // Append summary metadata trailer
  rows.push([]);
  rows.push([
    "SUMMARY METADATA",
    `Start Year: ${data.start_year}`,
    `End Year: ${data.end_year}`,
    `Branch Scope: ${branchLabel || data.branch_id || "Company-Wide Enterprise"}`,
    `Multi-Year Continuity Intact: ${
      data.overall_continuity_verified || data.multi_year_continuity_intact ? "YES" : "NO"
    }`,
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  const scopeTag = data.branch_id ? `Branch_${data.branch_id}` : "Enterprise";
  triggerCsvDownload(csv, `Cakes2Home_Retained_Earnings_RollForward_${scopeTag}_${data.start_year}_to_${data.end_year}.csv`);
}

export interface FiscalYearSummaryExportItem {
  fiscal_year: string;
  start_date: string;
  end_date: string;
  status: "OPEN" | "CLOSED";
  total_periods: number;
  locked_periods: number;
  all_periods_locked: boolean;
  active_closing_voucher_id: string | null;
  close_cycle_count: number;
  reopen_cycle_count: number;
  net_profit?: number;
  historical_lockout_active?: boolean;
}

/**
 * Export Fiscal Year Summary Cards to RFC-4180 CSV
 */
export function exportFiscalYearSummaryCsv(
  years: FiscalYearSummaryExportItem[],
  branchLabel?: string
): void {
  const headers = [
    "Fiscal Year",
    "Status",
    "Start Date",
    "End Date",
    "Total Periods",
    "Locked Periods",
    "All Periods Locked",
    "Active Closing Voucher ID",
    "Close Cycles",
    "Reopen Cycles",
    "Historical Lockout Active",
  ];

  const rows = years.map((y) => [
    y.fiscal_year,
    y.status,
    y.start_date,
    y.end_date,
    y.total_periods,
    y.locked_periods,
    y.all_periods_locked ? "YES" : "NO",
    y.active_closing_voucher_id || "N/A",
    y.close_cycle_count || 0,
    y.reopen_cycle_count || 0,
    y.historical_lockout_active ? "YES (READ-ONLY)" : "NO (ACTIVE)",
  ]);

  rows.push([]);
  rows.push([
    "SUMMARY METADATA",
    `Total Fiscal Years: ${years.length}`,
    `Branch Scope: ${branchLabel || "Company-Wide Enterprise"}`,
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `Cakes2Home_Fiscal_Year_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
}

export interface ComparativePnlLineExport {
  account_code: string;
  account_name: string;
  base_amount: number;
  compare_amount: number;
  variance_amount: number;
  variance_percentage: number | null;
}

export interface ComparativePnlSectionExport {
  section_key: string;
  section_title: string;
  base_total: number;
  compare_total: number;
  variance_amount: number;
  variance_percentage: number | null;
  lines: ComparativePnlLineExport[];
}

export interface ComparativePnlExportData {
  fiscal_year: string;
  compare_fiscal_year: string;
  branch_id: string | null;
  sections: ComparativePnlSectionExport[];
  summary: {
    base_gross_profit: number;
    compare_gross_profit: number;
    gross_profit_variance: number;
    gross_profit_variance_pct: number | null;
    base_net_operating_profit: number;
    compare_net_operating_profit: number;
    net_operating_profit_variance: number;
    net_operating_profit_variance_pct: number | null;
  };
}

/**
 * Export Side-by-Side Comparative P&L across 5 canonical sections to RFC-4180 CSV
 */
export function exportComparativeProfitLossCsv(
  data: any,
  branchLabel?: string
): void {
  const currentYear = data.current_fiscal_year || data.fiscal_year;
  const compareYear = data.compare_fiscal_year;

  const headers = [
    "Section",
    "Account Code",
    "Particulars",
    `Current FY (${currentYear}) [INR]`,
    `Compare FY (${compareYear}) [INR]`,
    "Variance Amount (INR)",
    "Variance Percentage (%)",
  ];

  const rows: (string | number | boolean | null | undefined)[][] = [];

  const rawSections = data.sections || {};
  const sectionList: any[] = Array.isArray(rawSections)
    ? rawSections
    : Object.values(rawSections);

  for (const sec of sectionList) {
    if (!sec) continue;
    const title = sec.label || sec.section_title || "Section";
    rows.push([title.toUpperCase(), "", "", "", "", "", ""]);

    const lines = sec.accounts || sec.lines || [];
    for (const line of lines) {
      const cur = line.current_amount != null ? line.current_amount : line.base_amount;
      const cmp = line.compare_amount;
      const vAmt = line.variance_amount;
      const vPct = line.variance_percent != null ? line.variance_percent : line.variance_percentage;

      rows.push([
        title,
        line.code || line.account_code || "",
        line.name || line.account_name || "",
        Number(cur || 0).toFixed(2),
        Number(cmp || 0).toFixed(2),
        Number(vAmt || 0).toFixed(2),
        vPct != null ? `${Number(vPct).toFixed(2)}%` : "N/A",
      ]);
    }

    const curTot = sec.current_total != null ? sec.current_total : sec.base_total;
    const cmpTot = sec.compare_total;
    const vTot = sec.variance_total != null ? sec.variance_total : sec.variance_amount;
    const vPctTot = sec.variance_percent != null ? sec.variance_percent : sec.variance_percentage;

    rows.push([
      `TOTAL ${title.toUpperCase()}`,
      "",
      "",
      Number(curTot || 0).toFixed(2),
      Number(cmpTot || 0).toFixed(2),
      Number(vTot || 0).toFixed(2),
      vPctTot != null ? `${Number(vPctTot).toFixed(2)}%` : "N/A",
    ]);
    rows.push([]);
  }

  // Summary
  if (data.summary) {
    rows.push(["PROFIT & LOSS SUMMARY", "", "", "", "", "", ""]);
    const addSummaryRow = (label: string, item: any) => {
      if (!item) return;
      rows.push([
        label,
        "",
        "",
        Number(item.current != null ? item.current : item.base_gross_profit != null ? item.base_gross_profit : item.base_net_operating_profit || 0).toFixed(2),
        Number(item.compare != null ? item.compare : item.compare_gross_profit != null ? item.compare_gross_profit : item.compare_net_operating_profit || 0).toFixed(2),
        Number(item.variance_amount != null ? item.variance_amount : item.gross_profit_variance != null ? item.gross_profit_variance : item.net_operating_profit_variance || 0).toFixed(2),
        item.variance_percent != null
          ? `${Number(item.variance_percent).toFixed(2)}%`
          : item.gross_profit_variance_pct != null
          ? `${Number(item.gross_profit_variance_pct).toFixed(2)}%`
          : "N/A",
      ]);
    };

    addSummaryRow("GROSS PROFIT", data.summary.gross_profit);
    addSummaryRow("OPERATING PROFIT", data.summary.operating_profit);
    addSummaryRow("NET PROFIT BEFORE TAX", data.summary.net_profit_before_tax);
    rows.push([]);
  }

  rows.push([
    "METADATA",
    `Current FY: ${currentYear}`,
    `Compare FY: ${compareYear}`,
    `Branch: ${branchLabel || data.branch_id || "Company-Wide Enterprise"}`,
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  const scopeTag = data.branch_id ? `Branch_${data.branch_id}` : "Enterprise";
  triggerCsvDownload(csv, `Cakes2Home_Comparative_PnL_${scopeTag}_${currentYear}_vs_${compareYear}.csv`);
}

/**
 * Export Standard Single-Period P&L Statement to RFC-4180 CSV
 */
export function exportStandardProfitLossCsv(data: any): void {
  const headers = ["Section", "Account Code", "Particulars", "Amount (INR)"];
  const rows: (string | number | boolean | null | undefined)[][] = [];

  const addSection = (
    title: string,
    accounts: { code: string; name: string; amount: number }[],
    totalLabel: string,
    totalAmount: number
  ) => {
    rows.push([title.toUpperCase(), "", "", ""]);
    for (const acc of accounts || []) {
      rows.push([title, acc.code, acc.name, Number(acc.amount || 0).toFixed(2)]);
    }
    rows.push([totalLabel, "", "", Number(totalAmount || 0).toFixed(2)]);
    rows.push([]);
  };

  if (data.operating_revenue) {
    addSection("Operating Revenue", data.operating_revenue.accounts, "NET REVENUE", data.operating_revenue.net_revenue);
  }
  if (data.cost_of_goods_sold) {
    addSection("Cost of Goods Sold", data.cost_of_goods_sold.accounts, "TOTAL COGS", data.cost_of_goods_sold.total_cogs);
  }
  if (data.operating_expenses) {
    addSection("Operating Expenses", data.operating_expenses.accounts, "TOTAL OPEX", data.operating_expenses.total_opex);
  }
  if (data.other_income) {
    addSection("Other Income", data.other_income.accounts, "TOTAL OTHER INCOME", data.other_income.total_other_income);
  }
  if (data.financial_expenses) {
    addSection("Financial Expenses", data.financial_expenses.accounts, "TOTAL FINANCIAL EXPENSES", data.financial_expenses.total_financial);
  }

  rows.push(["SUMMARY", "", "", ""]);
  rows.push(["GROSS PROFIT", "", "", Number(data.summary?.gross_profit || 0).toFixed(2)]);
  rows.push(["OPERATING PROFIT", "", "", Number(data.summary?.operating_profit || 0).toFixed(2)]);
  rows.push(["NET PROFIT BEFORE TAX", "", "", Number(data.summary?.net_profit_before_tax || 0).toFixed(2)]);

  rows.push([]);
  rows.push([
    "METADATA",
    `Period: ${data.period?.start_date} to ${data.period?.end_date}`,
    `Branch: ${data.branch?.name || "All Branches"}`,
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `Cakes2Home_Profit_Loss_${data.period?.start_date}_to_${data.period?.end_date}.csv`);
}

// ─── OPERATIONAL REPORT EXPORTS (Branch Manager) ─────────────────────────────

export interface BranchDailySalesReportItem {
  order_number: string;
  customer_name?: string;
  channel?: string;
  payment_method?: string;
  item_count?: number;
  subtotal?: number;
  gst?: number;
  total: number;
  status: string;
  created_at: string;
}

/**
 * Export Branch Daily Sales & Orders to RFC-4180 CSV
 */
export function exportBranchDailySalesCsv(
  orders: BranchDailySalesReportItem[],
  branchCode: string,
  reportRange: string
): void {
  const headers = [
    "Order Number",
    "Customer Name",
    "Channel",
    "Payment Method",
    "Items",
    "Subtotal (INR)",
    "GST (INR)",
    "Total (INR)",
    "Status",
    "Created At",
  ];

  const rows = orders.map((o) => [
    o.order_number,
    o.customer_name || "Walk-In Customer",
    o.channel || "Counter POS",
    o.payment_method || "CASH",
    o.item_count ?? 1,
    o.subtotal != null ? Number(o.subtotal).toFixed(2) : Number(o.total || 0).toFixed(2),
    o.gst != null ? Number(o.gst).toFixed(2) : "0.00",
    Number(o.total || 0).toFixed(2),
    o.status,
    o.created_at,
  ]);

  const totalRev = orders.reduce((acc, curr) => acc + Number(curr.total || 0), 0);
  rows.push([]);
  rows.push([
    "TOTALS",
    `Total Orders: ${orders.length}`,
    "",
    "",
    "",
    "",
    "",
    totalRev.toFixed(2),
    "",
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `Cakes2Home_Branch_Sales_${branchCode}_${reportRange}_${new Date().toISOString().slice(0, 10)}.csv`);
}

export interface BranchCashPositionExportData {
  branch_id: string;
  branch_code?: string;
  branch_name?: string;
  as_of: string;
  counter_cash_sales: number;
  pending_cod_custody: number;
  today_bank_deposits: number;
  active_session?: {
    id: string;
    opened_at: string;
    opening_float: number;
    status: string;
  } | null;
  drawer_is_open: boolean;
}

/**
 * Export Branch Cash Position & Drawer Session to RFC-4180 CSV
 */
export function exportBranchCashPositionCsv(
  cash: BranchCashPositionExportData,
  branchCode: string
): void {
  const headers = [
    "Metric",
    "Value (INR)",
    "Notes",
  ];

  const rows = [
    ["Opening Float in Drawer", Number(cash.active_session?.opening_float || 0).toFixed(2), "Physical float count at shift start"],
    ["Counter Cash Sales Collected", Number(cash.counter_cash_sales || 0).toFixed(2), "In-store cash payments received"],
    ["Pending COD in Custody", Number(cash.pending_cod_custody || 0).toFixed(2), "Undeposited cash held by delivery riders"],
    ["Today Bank Deposits Prepared/Dispatched", Number(cash.today_bank_deposits || 0).toFixed(2), "Cash sent for deposit into bank"],
    ["Drawer Status", cash.drawer_is_open ? "OPEN" : "CLOSED", `Active Session: ${cash.active_session?.id || "None"}`],
  ];

  rows.push([]);
  rows.push([
    "METADATA",
    `Branch: ${branchCode}`,
    `As Of: ${cash.as_of || new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `Cakes2Home_Cash_Position_${branchCode}_${new Date().toISOString().slice(0, 10)}.csv`);
}

export interface BranchInventoryDamageItem {
  id?: string;
  sku?: string;
  name: string;
  category: "1131" | "1132" | "1133" | string;
  damaged_quantity: number;
  reason_code: string;
  notes?: string;
  reported_at: string;
  reported_by?: string;
}

/**
 * Export Branch Spoilage / Damage Operational Log to RFC-4180 CSV
 * Invariant: Authoritative accounts exclusively 1131 (Accessories), 1132 (Cakes), 1133 (Packaging).
 */
export function exportBranchInventoryDamageCsv(
  items: BranchInventoryDamageItem[],
  branchCode: string
): void {
  const headers = [
    "Item SKU",
    "Item Name",
    "CoA Category",
    "Damaged Units",
    "Reason Code",
    "Notes",
    "Reported At",
    "Reported By",
  ];

  const rows = items.map((item) => [
    item.sku || "N/A",
    item.name,
    item.category === "1131"
      ? "1131 Merchandise - Accessories"
      : item.category === "1132"
      ? "1132 Merchandise - Cakes"
      : item.category === "1133"
      ? "1133 Packaging Supplies"
      : item.category,
    item.damaged_quantity,
    item.reason_code,
    item.notes || "",
    item.reported_at,
    item.reported_by || "Branch Staff",
  ]);

  rows.push([]);
  rows.push([
    "SUMMARY METADATA",
    `Total Incident Count: ${items.length}`,
    `Total Damaged Units: ${items.reduce((sum, i) => sum + (Number(i.damaged_quantity) || 0), 0)}`,
    `Branch: ${branchCode}`,
    `Export Date: ${new Date().toISOString()}`,
  ]);

  const csv = buildCsvString(headers, rows);
  triggerCsvDownload(csv, `Cakes2Home_Inventory_Damage_Log_${branchCode}_${new Date().toISOString().slice(0, 10)}.csv`);
}
