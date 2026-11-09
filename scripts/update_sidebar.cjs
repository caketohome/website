const fs = require('fs');
const filePath = 'E:/vig/cakes2home-main/cakes2home-main/frontend/src/components/admin/AdminSidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const target = `  {
    id: "finance",
    label: "Finance & Treasury",
    icon: Receipt,
    items: [
      { id: "work_queue", label: "⚡ Financial Work Queue", icon: ClipboardCheck, tabId: "accounting_work_queue" },
      { id: "bills_payable_fin", label: "Bills Payable (AP)", icon: Receipt, tabId: "bills_payable" },
      { id: "bills_receivable_fin", label: "Bills Receivable (AR)", icon: Receipt, tabId: "bills_receivable" },
      { id: "teller_custody", label: "Teller Cash Custody", icon: Wallet, tabId: "teller_custody" },
      { id: "manual_journals", label: "Manual Journals", icon: FileText, tabId: "manual_journals" },
      { id: "cost_allocations", label: "Cost Allocations", icon: PieChart, tabId: "cost_allocations" },
      { id: "gateway_settlements", label: "Gateway Settlements", icon: Receipt, tabId: "gateway_settlements" },
      { id: "bank_reconciliation", label: "Bank Reconciliation (BRS)", icon: Landmark, tabId: "bank_reconciliation" },
      { id: "general_ledger", label: "General Ledger", icon: BookOpen, tabId: "general_ledger" },
      { id: "profit_loss", label: "Profit & Loss", icon: TrendingUp, tabId: "profit_loss" },
      { id: "balance_sheet", label: "Balance Sheet", icon: Scale, tabId: "balance_sheet" },
      { id: "cash_flow", label: "Cash Flow", icon: Waves, tabId: "cash_flow" },
      { id: "accounting_setup", label: "Accounting Setup", icon: Settings2, tabId: "accounting_setup" },
    ],
  },`;

const replacement = `  {
    id: "finance",
    label: "Accounting",
    icon: Receipt,
    items: [
      { id: "overview", label: "Overview", icon: BookOpen, tabId: "general_ledger" },
      { id: "chart_of_accounts", label: "Chart of Accounts", icon: Settings2, tabId: "accounting_setup" },
      { id: "bank_management", label: "Bank & Cash Management", icon: Landmark, tabId: "bank_management" },
      { id: "bank_accounts", label: "Bank Accounts", icon: Landmark, tabId: "bank_accounts" },
      { id: "cash_accounts", label: "Cash Accounts", icon: Wallet, tabId: "teller_custody" },
      { id: "bank_transactions", label: "Bank Transactions", icon: Receipt, tabId: "bank_management" },
      { id: "bank_transfers", label: "Bank Transfers", icon: Waves, tabId: "bank_management" },
      { id: "bank_reconciliation", label: "Bank Reconciliation", icon: Landmark, tabId: "bank_reconciliation" },
      { id: "cashfree_settlements", label: "Cashfree Settlements", icon: Receipt, tabId: "gateway_settlements" },
      { id: "journal_entries", label: "Journal Entries", icon: FileText, tabId: "manual_journals" },
      { id: "accounting_vouchers", label: "Accounting Vouchers", icon: ClipboardCheck, tabId: "accounting_work_queue" },
      { id: "financial_reports", label: "Financial Reports", icon: TrendingUp, tabId: "profit_loss" },
      { id: "bills_payable_fin", label: "Bills Payable (AP)", icon: Receipt, tabId: "bills_payable" },
      { id: "bills_receivable_fin", label: "Bills Receivable (AR)", icon: Receipt, tabId: "bills_receivable" },
      { id: "cost_allocations", label: "Cost Allocations", icon: PieChart, tabId: "cost_allocations" },
      { id: "balance_sheet", label: "Balance Sheet", icon: Scale, tabId: "balance_sheet" },
      { id: "cash_flow", label: "Cash Flow", icon: Waves, tabId: "cash_flow" },
    ],
  },`;

const normContent = content.replace(/\r\n/g, '\n');
const normTarget = target.replace(/\r\n/g, '\n');

if (normContent.includes(normTarget)) {
  const updated = normContent.replace(normTarget, replacement);
  fs.writeFileSync(filePath, updated.replace(/\n/g, '\r\n'), 'utf8');
  console.log('Successfully updated AdminSidebar.tsx with Accounting Navigation!');
} else {
  console.log('Target not found in AdminSidebar.tsx');
}
