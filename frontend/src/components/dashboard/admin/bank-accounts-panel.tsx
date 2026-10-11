"use client";

/**
 * CakeToHome ERP — Bank Accounts Master Panel
 * Phase B: Enterprise Company Bank Account Master
 *
 * ARCHITECTURAL DESIGN & INVARIANTS:
 * 1. Bank accounts belong strictly to the COMPANY legal entity (Branches do not hold bank accounts).
 * 2. Strict 1:1 GL account mapping (Type=ASSET, Subtype=BANK).
 * 3. Safe display: Account numbers are masked (•••• •••• •••• 1234). Plaintext numbers never exposed.
 * 4. Master data management: Create, Edit, Activate, Deactivate, Freeze.
 */

import { useState, useEffect, useCallback, memo } from "react";
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
} from "lucide-react";
import { WidgetErrorBoundary } from "./error-boundary";
import type { BankAccountRow, BankAccountStatus, BankAccountType } from "@frontend/lib/types/accounting.types";

interface GlAccountOption {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
}

export const BankAccountsPanel = memo(function BankAccountsPanel() {
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [glAccounts, setGlAccounts] = useState<GlAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountRow | null>(null);
  const [saving, setSaving] = useState(false);

  // Form Fields
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [accountType, setAccountType] = useState<BankAccountType>("CURRENT");
  const [branchName, setBranchName] = useState("");
  const [selectedGlAccountId, setSelectedGlAccountId] = useState<string>("AUTO");
  const [formStatus, setFormStatus] = useState<BankAccountStatus>("ACTIVE");
  const [formError, setFormError] = useState<string | null>(null);

  // Copy Feedback
  const [copiedIfsc, setCopiedIfsc] = useState<string | null>(null);

  // ── Fetch Data ─────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const [accRes, coaRes] = await Promise.all([
        fetch(`/api/v1/admin/bank-accounts?${params.toString()}`),
        fetch("/api/v1/admin/accounting/accounts?type=ASSET&subtype=BANK"),
      ]);

      const accData = await accRes.json();
      if (accData.success) {
        setAccounts(accData.data || accData.bankAccounts || []);
      } else {
        setError(accData.message || "Failed to load bank accounts.");
      }

      const coaData = await coaRes.json();
      if (coaData.success) {
        setGlAccounts(coaData.accounts || coaData.data || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to bank accounts API.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Modal Handlers ─────────────────────────────────────────────────────────
  const handleOpenCreate = () => {
    setEditingAccount(null);
    setAccountName("");
    setBankName("");
    setAccountNumber("");
    setIfscCode("");
    setAccountType("CURRENT");
    setBranchName("");
    setSelectedGlAccountId("AUTO");
    setFormStatus("ACTIVE");
    setFormError(null);
    setShowModal(true);
  };

  const handleOpenEdit = (account: BankAccountRow) => {
    setEditingAccount(account);
    setAccountName(account.account_name);
    setBankName(account.bank_name);
    setAccountNumber(account.account_number_masked); // Masked representation displayed
    setIfscCode(account.ifsc_code);
    setAccountType(account.account_type || "CURRENT");
    setBranchName(account.branch_name || "");
    setSelectedGlAccountId(account.gl_account_id);
    setFormStatus(account.status);
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validations
    if (accountName.trim().length < 2) {
      setFormError("Account name must be at least 2 characters.");
      return;
    }
    if (bankName.trim().length < 2) {
      setFormError("Bank name must be at least 2 characters.");
      return;
    }
    if (!editingAccount && accountNumber.trim().length < 4) {
      setFormError("Valid account number with at least 4 digits is required.");
      return;
    }
    const cleanIfsc = ifscCode.trim().toUpperCase();
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
      setFormError("Invalid IFSC code. Format: 4 letters, 0, 6 letters/digits (e.g. HDFC0001234).");
      return;
    }

    setSaving(true);
    try {
      if (editingAccount) {
        // PUT update
        const body: any = {
          account_name: accountName.trim(),
          bank_name: bankName.trim(),
          ifsc_code: cleanIfsc,
          account_type: accountType,
          branch_name: branchName.trim() || null,
          status: formStatus,
        };
        if (selectedGlAccountId && selectedGlAccountId !== "AUTO") {
          body.gl_account_id = selectedGlAccountId;
        }

        const res = await fetch(`/api/v1/admin/bank-accounts/${editingAccount.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || "Failed to update bank account.");
        }
        setSuccessMessage(`Bank account "${accountName}" updated successfully.`);
      } else {
        // POST create
        const body: any = {
          account_name: accountName.trim(),
          bank_name: bankName.trim(),
          account_number: accountNumber.trim(),
          ifsc_code: cleanIfsc,
          account_type: accountType,
          branch_name: branchName.trim() || null,
          status: formStatus,
        };
        if (selectedGlAccountId !== "AUTO") {
          body.gl_account_id = selectedGlAccountId;
        }

        const res = await fetch("/api/v1/admin/bank-accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message || "Failed to create bank account.");
        }
        setSuccessMessage(`Bank account "${accountName}" created successfully.`);
      }

      setShowModal(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || "An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (account: BankAccountRow) => {
    const nextStatus: BankAccountStatus = account.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch(`/api/v1/admin/bank-accounts/${account.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "Failed to update account status.");
      }
      setSuccessMessage(`Status of "${account.account_name}" changed to ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      setError(err.message || "Failed to update account status.");
    }
  };

  const handleCopyIfsc = (ifsc: string) => {
    navigator.clipboard.writeText(ifsc);
    setCopiedIfsc(ifsc);
    setTimeout(() => setCopiedIfsc(null), 2000);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <WidgetErrorBoundary widgetName="Bank Accounts Panel">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
                <Landmark className="w-5 h-5" />
              </span>
              <Heading level="h2" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Bank Account Master
              </Heading>
              <Badge color="blue" size="small">
                Enterprise Treasury
              </Badge>
            </div>
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Corporate bank accounts owned by CakeToHome legal entity with strict 1:1 Double-Entry GL Ledger Mapping.
            </Text>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="base"
              onClick={loadData}
              disabled={loading}
              className="gap-2 shrink-0"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="primary"
              size="base"
              onClick={handleOpenCreate}
              className="gap-2 shrink-0 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4" />
              Add Bank Account
            </Button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-xl text-rose-700 dark:text-rose-300 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)} className="text-rose-500 hover:underline text-xs">
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="flex-1">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="text-emerald-500 hover:underline text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Bank Accounts</Text>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{accounts.length}</p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Accounts</Text>
            <p className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {accounts.filter((a) => a.status === "ACTIVE").length}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Mapped GL Accounts</Text>
            <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">
              {accounts.filter((a) => a.gl_account_id).length}
            </p>
          </div>
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">Ownership Model</Text>
            <p className="mt-1 text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              100% Company Legal Entity
            </p>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by bank name, account name, masked number, or IFSC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="FROZEN">Frozen</option>
            </select>
          </div>
        </div>

        {/* Bank Accounts Table */}
        <div className="overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-3.5 px-4">Bank & Branch</th>
                  <th className="py-3.5 px-4">Account Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Account Number</th>
                  <th className="py-3.5 px-4">IFSC Code</th>
                  <th className="py-3.5 px-4">Mapped GL Account</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                        <span>Loading enterprise bank accounts...</span>
                      </div>
                    </td>
                  </tr>
                ) : accounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Landmark className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                        <div>
                          <p className="font-semibold text-slate-700 dark:text-slate-300">No bank accounts configured</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Click &quot;Add Bank Account&quot; to configure your primary company banking details.
                          </p>
                        </div>
                        <Button variant="secondary" size="small" onClick={handleOpenCreate} className="mt-1">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Add First Bank Account
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  accounts.map((account) => {
                    const statusColors: Record<BankAccountStatus, "green" | "orange" | "blue"> = {
                      ACTIVE: "green",
                      INACTIVE: "orange",
                      FROZEN: "blue",
                    };

                    return (
                      <tr key={account.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-300">
                              <Building className="w-4 h-4" />
                            </span>
                            <div>
                              <div>{account.bank_name}</div>
                              {account.branch_name && (
                                <div className="text-xs text-slate-400 font-normal">{account.branch_name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {account.account_name}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {account.account_type || "CURRENT"}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-300">
                          <span title="Account numbers are masked for financial security">
                            {account.account_number_masked}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-xs">
                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-slate-800 dark:text-slate-200">
                              {account.ifsc_code}
                            </span>
                            <button
                              onClick={() => handleCopyIfsc(account.ifsc_code)}
                              title="Copy IFSC"
                              className="text-slate-400 hover:text-blue-500 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            {copiedIfsc === account.ifsc_code && (
                              <span className="text-[10px] text-emerald-500 font-sans">Copied!</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-900/50">
                              {account.gl_account_code || "1112"}
                            </span>
                            <span className="text-xs text-slate-600 dark:text-slate-400 truncate max-w-[150px]" title={account.gl_account_name || "Bank Operating Account"}>
                              {account.gl_account_name || "Bank Operating Account"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <Badge color={statusColors[account.status]} size="small">
                            {account.status}
                          </Badge>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleOpenEdit(account)}
                              title="Edit Bank Account"
                              className="h-8 w-8 p-0"
                            >
                              <Edit3 className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                            </Button>
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handleToggleStatus(account)}
                              title={account.status === "ACTIVE" ? "Deactivate Account" : "Activate Account"}
                              className={`h-8 w-8 p-0 ${
                                account.status === "ACTIVE"
                                  ? "hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                                  : "hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/30"
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Create / Edit Bank Account */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-lg">
                    <Landmark className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {editingAccount ? "Edit Bank Account Master" : "Create Company Bank Account"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Company Treasury Master with 1:1 Double-Entry GL Ledger Mapping
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg leading-none"
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleSave} className="p-6 space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Bank Name <span className="text-rose-500">*</span>
                    </Label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC Bank, ICICI Bank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      required
                      className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Account Nickname / Name <span className="text-rose-500">*</span>
                    </Label>
                    <input
                      type="text"
                      placeholder="e.g. Corporate Current A/c"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      required
                      className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Account Number <span className="text-rose-500">*</span>
                    </Label>
                    <input
                      type="text"
                      placeholder={editingAccount ? "Masked on edit" : "e.g. 50200012345678"}
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      disabled={!!editingAccount}
                      required={!editingAccount}
                      className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                    />
                    <span className="text-[11px] text-slate-400 mt-0.5 block">
                      Stored securely in DB; masked across all public listings.
                    </span>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      IFSC Code <span className="text-rose-500">*</span>
                    </Label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC0001234"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                      maxLength={11}
                      required
                      className="mt-1 w-full px-3 py-2 text-sm font-mono uppercase bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Account Type</Label>
                    <select
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as BankAccountType)}
                      className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="CURRENT">Current Account (Operating)</option>
                      <option value="SAVINGS">Savings Account</option>
                      <option value="OVERDRAFT">Overdraft (OD) Facility</option>
                      <option value="VIRTUAL">Virtual Account (Collection/Escrow)</option>
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Bank Branch Location (Optional)
                    </Label>
                    <input
                      type="text"
                      placeholder="e.g. Indiranagar, Bengaluru"
                      value={branchName}
                      onChange={(e) => setBranchName(e.target.value)}
                      className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* GL Mapping */}
                <div>
                  <Label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Double-Entry Chart of Accounts Mapping</span>
                    <span className="text-[11px] text-blue-500 font-normal">Strict 1:1 Mapping</span>
                  </Label>
                  <select
                    value={selectedGlAccountId}
                    onChange={(e) => setSelectedGlAccountId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {!editingAccount && (
                      <option value="AUTO">✨ Auto-provision dedicated Bank GL Account (under 1110)</option>
                    )}
                    {glAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.code} — {acc.name} {!acc.is_active ? "(Inactive)" : ""}
                      </option>
                    ))}
                  </select>
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    All disbursements, deposits, and settlement vouchers for this bank will credit/debit this specific GL account.
                  </span>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={saving}
                    className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]"
                  >
                    {saving ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </span>
                    ) : editingAccount ? (
                      "Save Changes"
                    ) : (
                      "Create Account"
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});

export default BankAccountsPanel;
