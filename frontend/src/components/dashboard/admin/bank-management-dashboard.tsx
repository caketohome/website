"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import {
  Landmark,
  Plus,
  Search,
  RefreshCw,
  Edit3,
  Power,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Copy,
  Lock,
  Building,
  CreditCard,
  Hash,
  Loader2,
  ExternalLink,
  ArrowRightLeft,
  FileText,
  Wallet,
  Clock,
  Upload,
  Check,
  ChevronRight,
  TrendingUp,
  Receipt,
  Eye,
  Calendar,
  X,
  FileSpreadsheet,
} from "lucide-react";
import { WidgetErrorBoundary } from "./error-boundary";
import type {
  BankAccountRow,
  BankAccountStatus,
  BankAccountType,
  BankTransactionRow,
  BankTransferRow,
  CashAccountRow,
} from "@frontend/lib/types/accounting.types";

interface GlAccountOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

interface SummaryData {
  totalBankAccounts: number;
  activeBankAccounts: number;
  totalBankBalance: number;
  totalCashBalance: number;
  pendingReconciliations: number;
  unmatchedTransactions: number;
}

type ActiveViewMode =
  | "dashboard"
  | "bank_accounts"
  | "cash_accounts"
  | "transactions"
  | "transfers"
  | "reconciliation"
  | "settlements";

export function BankManagementDashboard() {
  const [activeTab, setActiveTab] = useState<ActiveViewMode>("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Summary Metrics
  const [summary, setSummary] = useState<SummaryData>({
    totalBankAccounts: 0,
    activeBankAccounts: 0,
    totalBankBalance: 0,
    totalCashBalance: 0,
    pendingReconciliations: 0,
    unmatchedTransactions: 0,
  });

  // Data lists
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [cashAccounts, setCashAccounts] = useState<CashAccountRow[]>([]);
  const [transactions, setTransactions] = useState<BankTransactionRow[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [selectedBankId, setSelectedBankId] = useState<string>("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<BankAccountRow | null>(null);
  const [detailTab, setDetailTab] = useState<"overview" | "transactions" | "details" | "audit">("overview");

  // Add Bank Form state
  const [bankName, setBankName] = useState("HDFC Bank");
  const [accountHolderName, setAccountHolderName] = useState("CakeToHome India Private Limited");
  const [accountNumber, setAccountNumber] = useState("");
  const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [branchName, setBranchName] = useState("Indiranagar Bangalore");
  const [accountNickname, setAccountNickname] = useState("");
  const [accountType, setAccountType] = useState<BankAccountType>("CURRENT");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingBalanceDate, setOpeningBalanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedGlAccountId, setSelectedGlAccountId] = useState("AUTO");
  const [isPrimary, setIsPrimary] = useState(false);
  const [allowPayments, setAllowPayments] = useState(true);
  const [allowReceipts, setAllowReceipts] = useState(true);
  const [reconciliationRequired, setReconciliationRequired] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);

  // Transfer Form state
  const [transferSourceId, setTransferSourceId] = useState("");
  const [transferDestId, setTransferDestId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferRef, setTransferRef] = useState("");
  const [transferDesc, setTransferDesc] = useState("");
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Reconciliation Form state
  const [reconBankId, setReconBankId] = useState("");
  // Empty until the user pastes their real statement (was a hardcoded sample statement and balance).
  const [reconStatementBalance, setReconStatementBalance] = useState("");
  const [reconCsvInput, setReconCsvInput] = useState("");
  const [reconImportResult, setReconImportResult] = useState<any>(null);

  // ── Load All Data ───────────────────────────────────────────────────────────
  const loadAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load summary
      const sumRes = await fetch("/api/v1/accounting/dashboard/summary").catch(() => null);
      if (sumRes && sumRes.ok) {
        const sumJson = await sumRes.json();
        if (sumJson.success && sumJson.data) setSummary(sumJson.data);
      }

      // 2. Load Bank Accounts
      const accRes = await fetch("/api/v1/accounting/bank-accounts").catch(() => null);
      if (accRes && accRes.ok) {
        const accJson = await accRes.json();
        if (accJson.success) {
          const list = accJson.data || accJson.bankAccounts || [];
          setAccounts(list);
          if (list.length > 0 && !transferSourceId) {
            setTransferSourceId(list[0].id);
            if (list.length > 1) setTransferDestId(list[1].id);
            setReconBankId(list[0].id);
          }
        }
      }

      // 3. Load Cash Accounts
      const cashRes = await fetch("/api/v1/accounting/cash-accounts").catch(() => null);
      if (cashRes && cashRes.ok) {
        const cashJson = await cashRes.json();
        if (cashJson.success) setCashAccounts(cashJson.data || cashJson.cashAccounts || []);
      }

      // 4. Load Settlements
      const setRes = await fetch("/api/v1/accounting/cashfree-settlements").catch(() => null);
      if (setRes && setRes.ok) {
        const setJson = await setRes.json();
        if (setJson.success) setSettlements(setJson.data || setJson.settlements || []);
      }

      // 5. Load GL Bank Accounts for dropdown
      const glRes = await fetch("/api/v1/admin/accounting/accounts?type=ASSET&subtype=BANK").catch(() => null);
      if (glRes && glRes.ok) {
        const glJson = await glRes.json();
        if (glJson.success) setGlAccounts(glJson.accounts || glJson.data || []);
      }

      // 6. Load initial transactions if bank accounts exist
      if (accounts.length > 0 || accRes) {
        const firstId = accounts[0]?.id || "ba_hdfc_primary";
        const txRes = await fetch(`/api/v1/accounting/bank-accounts/${firstId}/transactions`).catch(() => null);
        if (txRes && txRes.ok) {
          const txJson = await txRes.json();
          if (txJson.success) setTransactions(txJson.data || txJson.transactions || []);
        }
      }
    } catch (err: any) {
      setError(err.message || "Failed to load banking data");
    } finally {
      setLoading(false);
    }
  }, [transferSourceId, accounts.length]);

  useEffect(() => {
    loadAllData();
  }, []);

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (statusFilter !== "ALL" && acc.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && acc.account_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          acc.account_name.toLowerCase().includes(q) ||
          acc.bank_name.toLowerCase().includes(q) ||
          acc.account_number_masked.toLowerCase().includes(q) ||
          acc.ifsc_code.toLowerCase().includes(q) ||
          (acc.gl_account_code && acc.gl_account_code.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [accounts, statusFilter, typeFilter, searchQuery]);

  // Load transactions for specific bank
  const handleSelectBankForTransactions = async (bankId: string) => {
    setSelectedBankId(bankId);
    try {
      const res = await fetch(`/api/v1/accounting/bank-accounts/${bankId}/transactions`);
      const json = await res.json();
      if (json.success) setTransactions(json.data || json.transactions || []);
    } catch (e) {}
  };

  // ── Handle Add Bank Account Form Submission ──────────────────────────────────
  const handleSaveBankAccount = async (addAnother: boolean = false) => {
    setFormError(null);
    // Display name of the account: nickname if provided, otherwise "<Bank> - <Holder>"
    const accountName = accountNickname.trim() || `${bankName.trim()} - ${accountHolderName.trim()}`;
    if (!bankName.trim()) return setFormError("Bank name is required.");
    if (!accountHolderName.trim()) return setFormError("Account holder name is required.");
    if (!accountNumber.trim()) return setFormError("Account number is required.");
    if (accountNumber.trim() !== confirmAccountNumber.trim()) {
      return setFormError("Account number and confirmation do not match.");
    }
    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      return setFormError("IFSC Code must match Indian standard (11 characters, e.g. HDFC0000053).");
    }

    setSavingAccount(true);
    try {
      const payload = {
        bank_name: bankName.trim(),
        account_name: accountName.trim(),
        account_number: accountNumber.trim(),
        ifsc_code: cleanIfsc,
        account_type: accountType,
        branch_name: branchName.trim(),
        gl_account_id: selectedGlAccountId === "AUTO" ? undefined : selectedGlAccountId,
        opening_balance: parseFloat(openingBalance) || 0,
        opening_balance_date: openingBalanceDate,
        is_primary: isPrimary,
        allow_payments: allowPayments,
        allow_receipts: allowReceipts,
        reconciliation_required: reconciliationRequired,
      };

      const res = await fetch("/api/v1/accounting/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to create bank account");
      }

      setSuccessMessage(`Bank account '${accountName}' successfully added and linked to General Ledger!`);
      setTimeout(() => setSuccessMessage(null), 5000);

      // Reload accounts & summary
      await loadAllData();

      if (addAnother) {
        setAccountNumber("");
        setConfirmAccountNumber("");
        setAccountNickname("");
        setOpeningBalance("0");
      } else {
        setShowAddModal(false);
      }
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSavingAccount(false);
    }
  };

  // ── Handle Transfer Funds Submission ─────────────────────────────────────────
  const handleExecuteTransfer = async () => {
    setTransferError(null);
    if (!transferSourceId || !transferDestId) {
      return setTransferError("Select both source and destination accounts.");
    }
    if (transferSourceId === transferDestId) {
      return setTransferError("Source and destination accounts cannot be identical.");
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      return setTransferError("Transfer amount must be greater than zero.");
    }

    setTransferSaving(true);
    try {
      const payload = {
        source_bank_account_id: transferSourceId,
        dest_bank_account_id: transferDestId,
        transfer_amount: amt,
        transfer_date: transferDate,
        reference_no: transferRef.trim() || undefined,
        description: transferDesc.trim() || undefined,
      };

      const res = await fetch("/api/v1/accounting/bank-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to post transfer");
      }

      setSuccessMessage(`Transferred ₹${amt.toLocaleString("en-IN")} successfully with posted Contra Journal Voucher!`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowTransferModal(false);
      setTransferAmount("");
      setTransferRef("");
      setTransferDesc("");
      await loadAllData();
    } catch (err: any) {
      setTransferError(err.message || "Failed to execute transfer");
    } finally {
      setTransferSaving(false);
    }
  };

  // ── Handle Deactivate Account ────────────────────────────────────────────────
  const handleDeactivate = async (accountId: string) => {
    if (!confirm("Are you sure you want to deactivate this bank account?")) return;
    try {
      const res = await fetch(`/api/v1/accounting/bank-accounts/${accountId}/deactivate`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage("Bank account deactivated.");
        setTimeout(() => setSuccessMessage(null), 4000);
        await loadAllData();
      }
    } catch (err: any) {
      alert("Failed to deactivate account: " + err.message);
    }
  };

  // ── Handle CSV Statement Import ──────────────────────────────────────────────
  const handleProcessCsvRecon = async () => {
    try {
      const lines = reconCsvInput
        .trim()
        .split("\n")
        .slice(1) // Skip header
        .map((row) => {
          const parts = row.split(",");
          return {
            date: parts[0]?.trim(),
            description: parts[1]?.trim(),
            reference_no: parts[2]?.trim(),
            debit: parseFloat(parts[3]) || 0,
            credit: parseFloat(parts[4]) || 0,
            balance: parseFloat(parts[5]) || 0,
          };
        })
        .filter((l) => l.date && (l.debit > 0 || l.credit > 0));

      const res = await fetch("/api/v1/accounting/reconciliations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank_account_id: reconBankId,
          file_name: "sample_bank_statement.csv",
          lines,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const bookBal = summary.totalBankBalance;
        const stmtBal = parseFloat(reconStatementBalance) || bookBal;
        const diff = Math.abs(stmtBal - bookBal);
        setReconImportResult({
          importedLines: lines.length,
          statementClosing: stmtBal,
          bookClosing: bookBal,
          reconciledAmount: stmtBal - diff,
          difference: diff,
          lines,
        });
      }
    } catch (e: any) {
      alert("Error importing CSV: " + e.message);
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 lg:p-6 space-y-6">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white shadow-xs">
              <Landmark className="w-5 h-5 text-brand-gold" />
            </div>
            <div>
              <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Bank &amp; Cash Management
                <Badge size="small" color="blue" className="font-mono text-[10px]">
                  Accounting / Treasury
                </Badge>
              </h1>
              <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400">
                Company Bank Accounts • Cash In Hand • Chart of Accounts Integration • Cashfree Settlement Clearing
              </p>
            </div>
          </div>
        </div>

        {/* Global Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={loadAllData}
            disabled={loading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            size="small"
            variant="secondary"
            onClick={() => setShowTransferModal(true)}
            className="flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-blue-600" />
            Transfer Funds
          </Button>

          <Button
            size="small"
            className="bg-brand-navy hover:bg-[#162447] text-white flex items-center gap-1.5 shadow-xs"
            onClick={() => {
              setAccountNickname("");
              setAccountNumber("");
              setConfirmAccountNumber("");
              setOpeningBalance("0");
              setFormError(null);
              setShowAddModal(true);
            }}
          >
            <Plus className="w-3.5 h-3.5 text-brand-gold" />
            Add Bank Account
          </Button>
        </div>
      </div>

      {/* ── Success and Error Banners ────────────────────────────────────────── */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-sm flex items-center gap-2.5 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-sm flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Module Navigation Tabs ───────────────────────────────────────────── */}
      <div className="flex overflow-x-auto gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-semibold scrollbar-none">
        {[
          { id: "dashboard", label: "Dashboard Overview", icon: Landmark },
          { id: "bank_accounts", label: `Bank Accounts (${accounts.length})`, icon: Landmark },
          { id: "cash_accounts", label: `Cash Accounts (${cashAccounts.length})`, icon: Wallet },
          { id: "transactions", label: "Bank Transactions", icon: Receipt },
          { id: "transfers", label: "Bank Transfers", icon: ArrowRightLeft },
          { id: "reconciliation", label: "Bank Reconciliation (BRS)", icon: FileSpreadsheet },
          { id: "settlements", label: "Gateway Settlements & Bank Verification", icon: ShieldCheck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as ActiveViewMode)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg transition-all shrink-0 ${
                isActive
                  ? "bg-brand-navy text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60"
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? "text-brand-gold" : ""}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 1: DASHBOARD OVERVIEW (SCREEN 1)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 lg:gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Bank A/c</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {summary.totalBankAccounts}
              </div>
              <span className="text-[10px] text-slate-400">Registered company banks</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Banks</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {summary.activeBankAccounts}
              </div>
              <span className="text-[10px] text-emerald-600/80">Available for payments</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Bank Balances</span>
              <div className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                ₹{Number(summary.totalBankBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">Ledger balance sum</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Cash Balances</span>
              <div className="text-xl font-bold text-brand-gold dark:text-brand-gold mt-1">
                ₹{Number(summary.totalCashBalance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </div>
              <span className="text-[10px] text-slate-400">Branch &amp; petty floats</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending Recon</span>
              <div className="text-xl font-bold text-brand-primary dark:text-brand-primary mt-1">
                {summary.pendingReconciliations}
              </div>
              <span className="text-[10px] text-slate-400">Open BRS periods</span>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Unmatched Items</span>
              <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">
                {summary.unmatchedTransactions}
              </div>
              <span className="text-[10px] text-slate-400">Transactions to reconcile</span>
            </div>
          </div>

          {/* Bank Accounts Overview (Table / Cards) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Landmark className="w-4 h-4 text-brand-gold" />
                  Company Bank Accounts Overview
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Primary corporate current and operating accounts linked to General Ledger
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="small" variant="secondary" onClick={() => setActiveTab("bank_accounts")}>
                  View All Register <ChevronRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/60 uppercase font-semibold text-slate-500 text-[11px] border-y border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Bank</th>
                    <th className="py-2.5 px-3">Account Nickname</th>
                    <th className="py-2.5 px-3">Account No</th>
                    <th className="py-2.5 px-3">Branch / Location</th>
                    <th className="py-2.5 px-3">GL Ledger Code</th>
                    <th className="py-2.5 px-3 text-right">Book Balance</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {accounts.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No bank accounts registered. Click &quot;Add Bank Account&quot; to initialize one.
                      </td>
                    </tr>
                  ) : (
                    accounts.map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="w-6 h-6 rounded-md bg-brand-navy/10 dark:bg-brand-navy/40 text-brand-navy dark:text-brand-gold flex items-center justify-center font-bold text-[10px]">
                            {acc.bank_name.charAt(0)}
                          </span>
                          {acc.bank_name}
                          {acc.is_primary && (
                            <Badge size="small" color="blue" className="text-[9px]">
                              Primary
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-3">{acc.account_name}</td>
                        <td className="py-3 px-3 font-mono font-medium text-slate-800 dark:text-slate-200">
                          {acc.account_number_masked}
                        </td>
                        <td className="py-3 px-3 text-slate-500">{acc.branch_name || "Headquarters"}</td>
                        <td className="py-3 px-3">
                          <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] text-slate-700 dark:text-slate-300">
                            {acc.gl_account_code || "1112"}
                          </span>{" "}
                          <span className="text-[10px] text-slate-400">({acc.gl_account_name || "Bank Operating"})</span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                          ₹{Number(acc.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge
                            size="small"
                            color={acc.status === "ACTIVE" ? "green" : acc.status === "FROZEN" ? "orange" : "grey"}
                          >
                            {acc.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => {
                                setSelectedAccountForDetail(acc);
                                setShowDetailModal(true);
                              }}
                              className="text-xs h-7 px-2"
                            >
                              <Eye className="w-3 h-3 mr-1" /> View
                            </Button>
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => {
                                setTransferSourceId(acc.id);
                                setShowTransferModal(true);
                              }}
                              className="text-xs h-7 px-2 text-blue-600"
                            >
                              Transfer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Dashboard Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div
              onClick={() => setShowAddModal(true)}
              className="p-4 rounded-xl bg-gradient-to-br from-brand-navy/5 to-brand-navy/10 dark:from-slate-900 dark:to-slate-850 border border-slate-200 dark:border-slate-800 hover:border-brand-navy cursor-pointer transition-all flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-navy text-brand-gold flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Add Bank Account</h4>
                <p className="text-xs text-slate-500 mt-0.5">Register account with automatic Chart of Accounts mapping</p>
              </div>
            </div>

            <div
              onClick={() => setShowTransferModal(true)}
              className="p-4 rounded-xl bg-gradient-to-br from-blue-50/50 to-blue-100/50 dark:from-slate-900 dark:to-slate-850 border border-slate-200 dark:border-slate-800 hover:border-blue-500 cursor-pointer transition-all flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Transfer Funds</h4>
                <p className="text-xs text-slate-500 mt-0.5">Balanced internal fund transfer between company banks</p>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("reconciliation")}
              className="p-4 rounded-xl bg-gradient-to-br from-brand-light/50 to-brand-light/50 dark:from-slate-900 dark:to-slate-850 border border-slate-200 dark:border-slate-800 hover:border-brand-primary cursor-pointer transition-all flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-primary text-white flex items-center justify-center shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Bank Reconciliation</h4>
                <p className="text-xs text-slate-500 mt-0.5">Import bank CSV statements &amp; match ledger entries</p>
              </div>
            </div>

            <div
              onClick={() => setActiveTab("settlements")}
              className="p-4 rounded-xl bg-gradient-to-br from-brand-gold-light/50 to-brand-gold-light/50 dark:from-slate-900 dark:to-slate-850 border border-slate-200 dark:border-slate-800 hover:border-brand-gold cursor-pointer transition-all flex items-start gap-3"
            >
              <div className="w-9 h-9 rounded-lg bg-brand-gold text-white flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Cashfree Clearing</h4>
                <p className="text-xs text-slate-500 mt-0.5">Transit clearing vs actual settled bank payouts</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 2: BANK ACCOUNTS REGISTER (SCREEN 3)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "bank_accounts" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">Bank Accounts Register</h3>
              <p className="text-xs text-slate-500">Searchable, filterable ledger of all registered bank accounts</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <Input
                  size="small"
                  placeholder="Search bank, account, IFSC..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="FROZEN">Frozen</option>
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                <option value="ALL">All Types</option>
                <option value="CURRENT">Current Account</option>
                <option value="SAVINGS">Savings Account</option>
                <option value="OVERDRAFT">Overdraft</option>
                <option value="VIRTUAL">Virtual</option>
              </select>

              <Button
                size="small"
                className="bg-brand-navy text-white"
                onClick={() => setShowAddModal(true)}
              >
                <Plus className="w-3.5 h-3.5 mr-1 text-brand-gold" /> Add Bank
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase font-semibold text-slate-500 text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Bank Name</th>
                  <th className="py-2.5 px-3">Account Nickname</th>
                  <th className="py-2.5 px-3">Masked Number</th>
                  <th className="py-2.5 px-3">IFSC</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Branch</th>
                  <th className="py-2.5 px-3">GL Ledger</th>
                  <th className="py-2.5 px-3 text-right">Ledger Balance</th>
                  <th className="py-2.5 px-3 text-right">Statement Bal</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-8 text-center text-slate-400">
                      No matching bank accounts found.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                        {acc.bank_name}
                      </td>
                      <td className="py-3 px-3">{acc.account_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-900 dark:text-slate-100 font-medium">
                        {acc.account_number_masked}
                      </td>
                      <td className="py-3 px-3 font-mono">{acc.ifsc_code}</td>
                      <td className="py-3 px-3">
                        <Badge size="small" color="grey">
                          {acc.account_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-slate-500">{acc.branch_name || "Headquarters"}</td>
                      <td className="py-3 px-3 font-mono text-[11px]">
                        {acc.gl_account_code || "1112"}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-mono text-slate-900 dark:text-white">
                        ₹{Number(acc.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-500">
                        ₹{Number(acc.statement_balance || acc.current_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          size="small"
                          color={acc.status === "ACTIVE" ? "green" : acc.status === "FROZEN" ? "orange" : "grey"}
                        >
                          {acc.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              setSelectedAccountForDetail(acc);
                              setShowDetailModal(true);
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            View
                          </Button>
                          <Button
                            size="small"
                            variant="secondary"
                            onClick={() => {
                              handleSelectBankForTransactions(acc.id);
                              setActiveTab("transactions");
                            }}
                            className="h-7 px-2 text-xs"
                          >
                            Transactions
                          </Button>
                          {acc.status === "ACTIVE" && (
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => handleDeactivate(acc.id)}
                              className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700"
                            >
                              Deactivate
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 3: CASH ACCOUNTS (SCREEN 8)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "cash_accounts" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-4 h-4 text-brand-gold" />
                Cash in Hand &amp; Branch Petty Cash Accounts
              </h3>
              <p className="text-xs text-slate-500">
                Imprest floats, branch till drawers, and COD transit floats mapped to GL 1111/1114
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {cashAccounts.length === 0 ? (
              <div className="col-span-3 py-8 text-center text-slate-400">No cash accounts registered.</div>
            ) : (
              cashAccounts.map((cash) => (
                <div
                  key={cash.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{cash.account_name}</span>
                    <Badge size="small" color="green">
                      {cash.status}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Type:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{cash.account_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Branch:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {cash.branch_name || "Indiranagar Hub"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>GL Ledger:</span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        {cash.gl_account_code || "1114"} ({cash.gl_account_name || "Petty Cash"})
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-750 flex items-baseline justify-between">
                    <span className="text-xs text-slate-400">Current Balance:</span>
                    <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
                      ₹{Number(cash.current_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 4: BANK TRANSACTIONS (SCREEN 5)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "transactions" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-gold" />
                Bank Transaction Register
              </h3>
              <p className="text-xs text-slate-500">
                Detailed chronologically sequenced bank passbook and running ledger balance
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Filter Bank:</Label>
              <select
                value={selectedBankId}
                onChange={(e) => handleSelectBankForTransactions(e.target.value)}
                className="text-xs py-1.5 px-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} ({b.account_number_masked})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase font-semibold text-slate-500 text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Reference No</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Debit (Outflow)</th>
                  <th className="py-2.5 px-3 text-right">Credit (Inflow)</th>
                  <th className="py-2.5 px-3 text-right">Running Balance</th>
                  <th className="py-2.5 px-3 text-center">Recon Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No recorded transactions for selected bank account.
                    </td>
                  </tr>
                ) : (
                  transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono">{tx.transaction_date}</td>
                      <td className="py-3 px-3">
                        <Badge
                          size="small"
                          color={
                            tx.transaction_type.includes("IN") || tx.transaction_type === "OPENING_BALANCE"
                              ? "green"
                              : "blue"
                          }
                        >
                          {tx.transaction_type}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 font-mono text-slate-500">{tx.reference_no || "—"}</td>
                      <td className="py-3 px-3 font-medium text-slate-900 dark:text-slate-100">{tx.description}</td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        {Number(tx.debit_amount) > 0 ? `₹${Number(tx.debit_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-emerald-600">
                        {Number(tx.credit_amount) > 0 ? `₹${Number(tx.credit_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—"}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{Number(tx.running_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge
                          size="small"
                          color={tx.reconciliation_status === "RECONCILED" || tx.reconciliation_status === "MATCHED" ? "green" : "orange"}
                        >
                          {tx.reconciliation_status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 5: BANK TRANSFERS WORKFLOW (SCREEN 6)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "transfers" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5 max-w-3xl mx-auto">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Transfer Funds Between Company Bank Accounts
            </h3>
            <p className="text-xs text-slate-500">
              Posts an atomic double-entry Contra Journal Voucher (Debit: Destination Bank, Credit: Source Bank).
            </p>
          </div>

          {transferError && (
            <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {transferError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Source Bank Account</Label>
              <select
                value={transferSourceId}
                onChange={(e) => setTransferSourceId(e.target.value)}
                className="w-full mt-1.5 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} ({acc.account_number_masked}) — Bal: ₹{Number(acc.current_balance).toLocaleString("en-IN")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Destination Bank Account</Label>
              <select
                value={transferDestId}
                onChange={(e) => setTransferDestId(e.target.value)}
                className="w-full mt-1.5 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.bank_name} ({acc.account_number_masked})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Transfer Amount (₹)</Label>
              <Input
                type="number"
                placeholder="e.g. 50000"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="mt-1.5 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Transfer Date</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
                className="mt-1.5 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Reference / UTR / Cheque No</Label>
              <Input
                placeholder="e.g. UTR-99120491"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                className="mt-1.5 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Description / Narration</Label>
              <Input
                placeholder="e.g. Sweep transfer to operating account"
                value={transferDesc}
                onChange={(e) => setTransferDesc(e.target.value)}
                className="mt-1.5 text-xs"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button
              className="bg-brand-navy text-white"
              onClick={handleExecuteTransfer}
              disabled={transferSaving}
            >
              {transferSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
              Post Transfer Voucher
            </Button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 6: BANK RECONCILIATION STATEMENT (SCREEN 7)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "reconciliation" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-brand-primary" />
                Bank Reconciliation Statement (BRS) &amp; Statement Import
              </h3>
              <p className="text-xs text-slate-500">
                Import CSV bank statement, match against ledger lines, identify discrepancies, and balance book vs statement
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500">Bank Account:</Label>
              <select
                value={reconBankId}
                onChange={(e) => setReconBankId(e.target.value)}
                className="text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
              >
                {accounts.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bank_name} ({b.account_number_masked})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Paste CSV Bank Statement (Date, Description, Reference, Debit, Credit, Balance)
              </Label>
              <textarea
                rows={7}
                value={reconCsvInput}
                onChange={(e) => setReconCsvInput(e.target.value)}
                placeholder={"Date,Description,Reference,Debit,Credit,Balance\n2026-04-01,Opening balance,REF-1,0,10000,10000"}
                className="w-full font-mono text-xs p-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-navy"
              />
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  placeholder="Statement Closing Balance"
                  value={reconStatementBalance}
                  onChange={(e) => setReconStatementBalance(e.target.value)}
                  className="w-48 text-xs font-mono"
                />
                <Button size="small" className="bg-brand-navy text-white" onClick={handleProcessCsvRecon}>
                  <Upload className="w-3.5 h-3.5 mr-1 text-brand-gold" /> Parse &amp; Match Statement
                </Button>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Reconciliation Balance Summary</h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Statement Closing Balance:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{Number(reconStatementBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Book Closing Balance:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{Number(summary.totalBankBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">Reconciled / Matched Items:</span>
                  <span className="font-mono font-medium text-emerald-600">
                    {reconImportResult ? `${reconImportResult.importedLines} items matched` : "Pending import"}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-t border-slate-300 dark:border-slate-700 text-sm">
                  <span className="font-bold text-slate-900 dark:text-white">Difference / Variance:</span>
                  <span
                    className={`font-mono font-bold ${
                      reconImportResult && reconImportResult.difference === 0 ? "text-emerald-600" : "text-brand-gold"
                    }`}
                  >
                    ₹{reconImportResult ? reconImportResult.difference.toLocaleString("en-IN", { minimumFractionDigits: 2 }) : "0.00"}
                  </span>
                </div>
              </div>

              {reconImportResult && (
                <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs flex items-center gap-2 border border-emerald-200">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Imported {reconImportResult.importedLines} lines. Audit trail logged for reconciliation sign-off.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODE 7: CASHFREE SETTLEMENTS (SECTION 10)
         ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "settlements" && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-brand-gold" />
              Cashfree Settlement Clearing Ledger (1010_CASHFREE_CLEARING / 1113)
            </h3>
            <p className="text-xs text-slate-500">
              Clear segregation: Customer collections transit through Gateway Clearing before net settlement deposit into company bank account
            </p>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase font-semibold text-slate-500 text-[11px] border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Settlement ID</th>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Destination Bank</th>
                  <th className="py-2.5 px-3 text-right">Gross Captured</th>
                  <th className="py-2.5 px-3 text-right">Gateway Fees</th>
                  <th className="py-2.5 px-3 text-right">GST on Fee</th>
                  <th className="py-2.5 px-3 text-right">Net Bank Settlement</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-400">
                      No Cashfree settlements recorded yet. Automated payout webhooks populate this clearing ledger.
                    </td>
                  </tr>
                ) : (
                  settlements.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-medium text-blue-600">{st.settlement_id}</td>
                      <td className="py-3 px-3 font-mono">{st.settlement_date}</td>
                      <td className="py-3 px-3">{st.bank_name || "HDFC Bank"} ({st.account_number_masked})</td>
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        ₹{Number(st.gross_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        ₹{Number(st.fee_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-600">
                        ₹{Number(st.tax_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600">
                        ₹{Number(st.net_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <Badge size="small" color="green">
                          {st.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SCREEN 2: ADD BANK ACCOUNT MODAL (FULL POLISHED FORM)
         ═══════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-navy text-brand-gold flex items-center justify-center">
                  <Landmark className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">Add Company Bank Account</h3>
                  <p className="text-xs text-slate-500">Configure corporate bank master &amp; link to Chart of Accounts</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {formError}
              </div>
            )}

            {/* A. Bank Information */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold flex items-center gap-1.5">
                <span>A. Bank Information</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">Bank Name *</Label>
                  <Input
                    placeholder="e.g. HDFC Bank, ICICI Bank, SBI"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Account Holder Name *</Label>
                  <Input
                    placeholder="e.g. CakeToHome India Private Limited"
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Account Number *</Label>
                  <Input
                    type="password"
                    placeholder="Full account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Confirm Account Number *</Label>
                  <Input
                    type="text"
                    placeholder="Re-enter to verify"
                    value={confirmAccountNumber}
                    onChange={(e) => setConfirmAccountNumber(e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">IFSC Code * (11 Alphanumeric)</Label>
                  <Input
                    placeholder="e.g. HDFC0000053"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                    className="mt-1 text-xs font-mono uppercase"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Branch Location / Name</Label>
                  <Input
                    placeholder="e.g. Indiranagar Bangalore"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* B. Account Classification */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold">
                B. Account Classification
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium">Account Nickname</Label>
                  <Input
                    placeholder="e.g. Primary Ops A/c"
                    value={accountNickname}
                    onChange={(e) => setAccountNickname(e.target.value)}
                    className="mt-1 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Account Type</Label>
                  <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value as BankAccountType)}
                    className="w-full mt-1 p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="CURRENT">Current Account</option>
                    <option value="SAVINGS">Savings Account</option>
                    <option value="OVERDRAFT">Overdraft</option>
                    <option value="VIRTUAL">Virtual</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs font-medium">Currency</Label>
                  <Input value="INR (₹)" disabled className="mt-1 text-xs bg-slate-100 dark:bg-slate-800" />
                </div>
                <div>
                  <Label className="text-xs font-medium">Opening Balance (₹)</Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Opening Balance Date</Label>
                  <Input
                    type="date"
                    value={openingBalanceDate}
                    onChange={(e) => setOpeningBalanceDate(e.target.value)}
                    className="mt-1 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium">Associated Kitchen Hub</Label>
                  <select
                    className="w-full mt-1 p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="br_indiranagar_01">Indiranagar Kitchen Hub (IND-01)</option>
                    <option value="br_whitefield_06">Whitefield Hub (WHF-06)</option>
                    <option value="br_partner_04">Pune Gourmet Partner Hub (PUN-04)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* C. Accounting Configuration */}
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold">
                C. Accounting Configuration (Chart of Accounts)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">General Ledger (GL) Account</Label>
                  <select
                    value={selectedGlAccountId}
                    onChange={(e) => setSelectedGlAccountId(e.target.value)}
                    className="w-full mt-1 p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="AUTO">✨ Auto-Provision Dedicated Child GL under 1110</option>
                    {glAccounts.map((gl) => (
                      <option key={gl.id} value={gl.id}>
                        {gl.code} — {gl.name}
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Strict 1:1 GL account linkage. No duplicate mappings.
                  </span>
                </div>
                <div>
                  <Label className="text-xs font-medium">Opening Balance Offset Account</Label>
                  <Input value="3300 - Opening Balance Offset / Capital Reserve" disabled className="mt-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-500" />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Balanced journal entry: Debit Bank GL, Credit Offset Equity
                  </span>
                </div>
              </div>
            </div>

            {/* D. Account Controls */}
            <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-navy dark:text-brand-gold">
                D. Operational Controls
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={isPrimary}
                    onChange={(e) => setIsPrimary(e.target.checked)}
                    className="rounded text-brand-navy"
                  />
                  <span>Primary Account</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={allowPayments}
                    onChange={(e) => setAllowPayments(e.target.checked)}
                    className="rounded text-brand-navy"
                  />
                  <span>Allow Payments</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={allowReceipts}
                    onChange={(e) => setAllowReceipts(e.target.checked)}
                    className="rounded text-brand-navy"
                  />
                  <span>Allow Receipts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={reconciliationRequired}
                    onChange={(e) => setReconciliationRequired(e.target.checked)}
                    className="rounded text-brand-navy"
                  />
                  <span>Recon Required</span>
                </label>
              </div>
            </div>

            {/* E. Action Buttons */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setShowAddModal(false)}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="secondary"
                disabled={savingAccount}
                onClick={() => handleSaveBankAccount(true)}
              >
                Save &amp; Add Another
              </Button>
              <Button
                size="small"
                className="bg-brand-navy text-white"
                disabled={savingAccount}
                onClick={() => handleSaveBankAccount(false)}
              >
                {savingAccount ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Save Bank Account
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SCREEN 4: BANK ACCOUNT DETAIL MODAL / DRAWER
         ═══════════════════════════════════════════════════════════════════════ */}
      {showDetailModal && selectedAccountForDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-navy text-brand-gold flex items-center justify-center font-bold">
                  {selectedAccountForDetail.bank_name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {selectedAccountForDetail.bank_name} — {selectedAccountForDetail.account_name}
                    <Badge size="small" color={selectedAccountForDetail.status === "ACTIVE" ? "green" : "grey"}>
                      {selectedAccountForDetail.status}
                    </Badge>
                  </h3>
                  <p className="text-xs font-mono text-slate-500">
                    Account: {selectedAccountForDetail.account_number_masked} • IFSC: {selectedAccountForDetail.ifsc_code}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
              {(["overview", "verification", "transactions", "details", "audit"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setDetailTab(t)}
                  className={`px-3 py-1.5 rounded-lg capitalize transition-colors ${
                    detailTab === t
                      ? "bg-brand-navy text-white"
                      : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Detail Tab Contents */}
            {detailTab === "overview" && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Current Balance</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                      ₹{Number(selectedAccountForDetail.current_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Opening Balance</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                      ₹{Number(selectedAccountForDetail.opening_balance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Statement Balance</span>
                    <span className="text-base font-bold font-mono text-slate-900 dark:text-white mt-1 block">
                      ₹{Number(selectedAccountForDetail.statement_balance || selectedAccountForDetail.current_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">GL Ledger Code</span>
                    <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400 mt-1 block">
                      {selectedAccountForDetail.gl_account_code || "1112"}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <h4 className="font-bold text-slate-800 dark:text-slate-200">General Ledger Mapping Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">Linked GL Account Name:</span>{" "}
                      <span className="font-semibold">{selectedAccountForDetail.gl_account_name || "Bank Operating A/c"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Account Classification:</span>{" "}
                      <span className="font-semibold">Asset → Current Assets → Bank Accounts (1110)</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Legal Entity:</span>{" "}
                      <span className="font-semibold">CakeToHome India Private Limited</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Associated Branch:</span>{" "}
                      <span className="font-semibold">{selectedAccountForDetail.branch_name || "Indiranagar Kitchen Hub"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {detailTab === "verification" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        Settlement Account Verification Status
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Manual accounting control: Verification by authorized Finance Lead before settlement clearance.
                      </p>
                    </div>
                    <Badge
                      size="large"
                      color={
                        selectedAccountForDetail.verification_status === "VERIFIED"
                          ? "green"
                          : selectedAccountForDetail.verification_status === "UNDER_REVIEW"
                          ? "blue"
                          : selectedAccountForDetail.verification_status === "PENDING_VERIFICATION"
                          ? "orange"
                          : selectedAccountForDetail.verification_status === "REJECTED"
                          ? "red"
                          : "grey"
                      }
                    >
                      {selectedAccountForDetail.verification_status || "NOT_SUBMITTED"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Verified By</span>
                      <span className="font-mono">{selectedAccountForDetail.verified_by || "Pending Review"}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Verification Date</span>
                      <span>{selectedAccountForDetail.verified_at ? new Date(selectedAccountForDetail.verified_at).toLocaleString("en-IN") : "Not Verified"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Accounting Remarks</span>
                      <p className="mt-0.5 text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                        {selectedAccountForDetail.verification_remarks || "No verification remarks recorded yet."}
                      </p>
                    </div>
                    {selectedAccountForDetail.verification_document_url && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Supporting Bank Statement / Evidence</span>
                        <span className="font-mono text-blue-600 dark:text-blue-400">{selectedAccountForDetail.verification_document_url}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Verification Action Form */}
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    Record Verification Review (Finance & Accounts)
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Update Verification State
                      </Label>
                      <select
                        id="verify_status_select"
                        defaultValue={selectedAccountForDetail.verification_status || "PENDING_VERIFICATION"}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mt-1"
                      >
                        <option value="NOT_SUBMITTED">NOT_SUBMITTED</option>
                        <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
                        <option value="UNDER_REVIEW">UNDER_REVIEW</option>
                        <option value="VERIFIED">VERIFIED (Approved)</option>
                        <option value="REJECTED">REJECTED</option>
                        <option value="REQUIRES_REVIEW">REQUIRES_REVIEW</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Verification Remarks / Audit Notes
                      </Label>
                      <textarea
                        id="verify_remarks_input"
                        rows={2}
                        placeholder="e.g. Account name and IFSC verified against official HDFC statement."
                        className="w-full text-xs p-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                        Supporting Statement / Document Reference URL
                      </Label>
                      <Input
                        id="verify_doc_input"
                        placeholder="docs/bank-statements/statement_ref_2026.pdf"
                        className="text-xs mt-1"
                      />
                    </div>
                    <Button
                      size="small"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white w-full"
                      onClick={async () => {
                        const statusEl = document.getElementById("verify_status_select") as HTMLSelectElement;
                        const remarksEl = document.getElementById("verify_remarks_input") as HTMLTextAreaElement;
                        const docEl = document.getElementById("verify_doc_input") as HTMLInputElement;
                        if (!statusEl) return;
                        try {
                          const res = await fetch(`/api/v1/admin/accounting/bank-accounts/${selectedAccountForDetail.id}/verify`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              verification_status: statusEl.value,
                              remarks: remarksEl?.value,
                              document_url: docEl?.value
                            })
                          });
                          const json = await res.json();
                          if (json.success) {
                            alert("Verification state saved successfully.");
                            window.location.reload();
                          } else {
                            alert("Error: " + (json.message || json.error));
                          }
                        } catch (err: any) {
                          alert("Network error: " + err.message);
                        }
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" /> Save Verification Review
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {detailTab === "transactions" && (
              <div className="space-y-3">
                <Button
                  size="small"
                  variant="secondary"
                  onClick={() => handleSelectBankForTransactions(selectedAccountForDetail.id)}
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh Transactions
                </Button>
                <div className="max-h-60 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-lg">
                  <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-[10px] uppercase font-semibold text-slate-500">
                      <tr>
                        <th className="p-2">Date</th>
                        <th className="p-2">Type</th>
                        <th className="p-2">Description</th>
                        <th className="p-2 text-right">Debit</th>
                        <th className="p-2 text-right">Credit</th>
                        <th className="p-2 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {transactions.filter((t) => t.bank_account_id === selectedAccountForDetail.id).length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-4 text-center text-slate-400">No transactions recorded.</td>
                        </tr>
                      ) : (
                        transactions
                          .filter((t) => t.bank_account_id === selectedAccountForDetail.id)
                          .map((t) => (
                            <tr key={t.id}>
                              <td className="p-2">{t.transaction_date}</td>
                              <td className="p-2">{t.transaction_type}</td>
                              <td className="p-2 font-sans">{t.description}</td>
                              <td className="p-2 text-right text-rose-600">{Number(t.debit_amount) > 0 ? `₹${t.debit_amount}` : "—"}</td>
                              <td className="p-2 text-right text-emerald-600">{Number(t.credit_amount) > 0 ? `₹${t.credit_amount}` : "—"}</td>
                              <td className="p-2 text-right font-bold text-slate-900 dark:text-white">₹{t.running_balance}</td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {detailTab === "details" && (
              <div className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
                <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div>
                    <span className="text-slate-400 block">Bank Master Record ID:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{selectedAccountForDetail.id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">GL Foreign Key:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{selectedAccountForDetail.gl_account_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Opening Balance Date:</span>
                    <span className="font-mono text-slate-900 dark:text-white">{selectedAccountForDetail.opening_balance_date || "2026-04-01"}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Reconciliation Mandate:</span>
                    <span className="text-slate-900 dark:text-white">{selectedAccountForDetail.reconciliation_required !== false ? "Required (Monthly BRS)" : "Optional"}</span>
                  </div>
                </div>
              </div>
            )}

            {detailTab === "audit" && (
              <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg space-y-1.5 font-mono text-[11px]">
                  <div>Created By: {selectedAccountForDetail.created_by}</div>
                  <div>Created At: {selectedAccountForDetail.created_at}</div>
                  <div>Last Updated By: {selectedAccountForDetail.updated_by}</div>
                  <div>Last Updated At: {selectedAccountForDetail.updated_at}</div>
                  <div>Database Target: PostgreSQL cth_rehearsal_phase5 (public.bank_account)</div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <Button size="small" variant="secondary" onClick={() => setShowDetailModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Transfer Modal when called from other tabs */}
      {showTransferModal && activeTab !== "transfers" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-blue-600" /> Transfer Funds
              </h3>
              <button onClick={() => setShowTransferModal(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {transferError && (
              <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {transferError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <Label className="text-xs font-semibold">Source Account</Label>
                <select
                  value={transferSourceId}
                  onChange={(e) => setTransferSourceId(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} ({acc.account_number_masked}) — Bal: ₹{Number(acc.current_balance).toLocaleString("en-IN")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold">Destination Account</Label>
                <select
                  value={transferDestId}
                  onChange={(e) => setTransferDestId(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800 border rounded-lg"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.bank_name} ({acc.account_number_masked})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs font-semibold">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 font-mono text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold">Date</Label>
                  <Input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="mt-1 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <Button size="small" variant="secondary" onClick={() => setShowTransferModal(false)}>
                Cancel
              </Button>
              <Button size="small" className="bg-brand-navy text-white" onClick={handleExecuteTransfer} disabled={transferSaving}>
                {transferSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                Execute Transfer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankManagementDashboard;
