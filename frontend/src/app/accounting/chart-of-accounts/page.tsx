"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AdminShell } from "@frontend/components/admin/AdminShell";
import { AdminSidebar } from "@frontend/components/admin/AdminSidebar";
import { AdminTopbar } from "@frontend/components/admin/AdminTopbar";
import { DashboardErrorBoundary } from "@frontend/components/dashboard/admin/error-boundary";
import { useRouter } from "next/navigation";
import {
  FolderTree,
  Search,
  RefreshCw,
  Eye,
  Filter,
  CheckCircle,
  Building,
  Layers,
  ChevronRight,
  ChevronDown,
  BookOpen,
} from "lucide-react";
import { Badge, Button, Input } from "@medusajs/ui";

interface AccountItem {
  id: string;
  code: string;
  name: string;
  type: string;
  subtype: string;
  level: number;
  is_group: boolean;
  is_active: boolean;
  parent_id: string | null;
  total_debit?: number;
  total_credit?: number;
}

export default function ChartOfAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [groupFilter, setGroupFilter] = useState("ALL");

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/accounting/accounts?include_groups=true");
      const json = await res.json();
      if (json.success && Array.isArray(json.accounts)) {
        setAccounts(json.accounts);
      } else {
        throw new Error(json.message || "Failed to load Chart of Accounts");
      }
    } catch (err: any) {
      setError(err.message || "Error loading Chart of Accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleNavigate = (tabId: string) => {
    if (tabId === "accounting_setup") {
      router.push("/accounting/chart-of-accounts");
    } else if (tabId === "bank_management" || tabId === "bank_accounts") {
      router.push("/accounting/bank-management");
    } else {
      router.push(`/dashboard?tab=${tabId}`);
    }
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      if (typeFilter !== "ALL" && acc.type !== typeFilter) return false;
      if (groupFilter === "GROUPS_ONLY" && !acc.is_group) return false;
      if (groupFilter === "POSTING_ONLY" && acc.is_group) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return acc.code.toLowerCase().includes(q) || acc.name.toLowerCase().includes(q) || acc.subtype?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [accounts, typeFilter, groupFilter, search]);

  const summary = useMemo(() => {
    const total = accounts.length;
    const groups = accounts.filter((a) => a.is_group).length;
    const posting = total - groups;
    const assets = accounts.filter((a) => a.type === "ASSET").length;
    const liabilities = accounts.filter((a) => a.type === "LIABILITY").length;
    const equity = accounts.filter((a) => a.type === "EQUITY").length;
    const revenue = accounts.filter((a) => a.type === "REVENUE").length;
    const expense = accounts.filter((a) => a.type === "EXPENSE").length;
    return { total, groups, posting, assets, liabilities, equity, revenue, expense };
  }, [accounts]);

  const getNormalBalance = (type: string) => {
    return type === "ASSET" || type === "EXPENSE" ? "DEBIT" : "CREDIT";
  };

  return (
    <AdminShell
      sidebar={<AdminSidebar activeTabId="accounting_setup" onNavigate={handleNavigate} />}
      topbar={
        <AdminTopbar
          breadcrumbs={[
            { label: "Accounting", href: "/accounting/bank-management" },
            { label: "Chart of Accounts Hierarchy", href: "/accounting/chart-of-accounts" },
          ]}
        />
      }
    >
      <DashboardErrorBoundary moduleName="Chart of Accounts">
        <div className="w-full min-h-screen bg-slate-50/50 dark:bg-slate-950 p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white shadow-xs">
                <FolderTree className="w-5 h-5 text-brand-gold" />
              </div>
              <div>
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Chart of Accounts Hierarchy
                  <Badge size="small" color="blue" className="font-mono text-[10px]">
                    Master CoA
                  </Badge>
                </h1>
                <p className="text-xs lg:text-sm text-slate-500 dark:text-slate-400">
                  5-Level Hierarchical General Ledger Account Tree • Assets, Liabilities, Equity, Revenue, Expense
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="small" variant="secondary" onClick={loadAccounts} disabled={loading} className="flex items-center gap-1.5">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
              <Button
                size="small"
                className="bg-brand-navy text-white flex items-center gap-1.5"
                onClick={() => router.push("/dashboard?tab=general_ledger")}
              >
                <BookOpen className="w-3.5 h-3.5 text-brand-gold" /> View General Ledger
              </Button>
            </div>
          </div>

          {/* Metric Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total GL A/c</span>
              <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{summary.total}</div>
              <span className="text-[10px] text-slate-400 font-mono">107 master accounts</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group Heads</span>
              <div className="text-xl font-bold text-brand-primary dark:text-brand-primary mt-0.5">{summary.groups}</div>
              <span className="text-[10px] text-slate-400">Structural parent tiers</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Posting A/c</span>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{summary.posting}</div>
              <span className="text-[10px] text-slate-400">Direct journal posting</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">1xxx Assets</span>
              <div className="text-xl font-bold text-blue-600 mt-0.5">{summary.assets}</div>
              <span className="text-[10px] text-slate-400">Bank, Cash, Clearing</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-brand-gold uppercase tracking-wider">2xxx Liabilities</span>
              <div className="text-xl font-bold text-brand-gold mt-0.5">{summary.liabilities}</div>
              <span className="text-[10px] text-slate-400">GST, Payables, Advance</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-brand-primary uppercase tracking-wider">3xxx Equity</span>
              <div className="text-xl font-bold text-brand-primary mt-0.5">{summary.equity}</div>
              <span className="text-[10px] text-slate-400">Share capital, Offset</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">4xxx Revenue</span>
              <div className="text-xl font-bold text-emerald-600 mt-0.5">{summary.revenue}</div>
              <span className="text-[10px] text-slate-400">Cake &amp; Bakery sales</span>
            </div>
            <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
              <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider">5xxx Expenses</span>
              <div className="text-xl font-bold text-rose-600 mt-0.5">{summary.expense}</div>
              <span className="text-[10px] text-slate-400">COGS, MDR, Logistics</span>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-72">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <Input
                    size="small"
                    placeholder="Search account code, name, subtype..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 text-xs font-mono"
                  />
                </div>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="ALL">All Account Types</option>
                  <option value="ASSET">Assets (1000)</option>
                  <option value="LIABILITY">Liabilities (2000)</option>
                  <option value="EQUITY">Equity (3000)</option>
                  <option value="REVENUE">Revenue (4000)</option>
                  <option value="EXPENSE">Expense (5000)</option>
                </select>

                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="text-xs py-1.5 px-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="ALL">All Levels (Groups &amp; Posting)</option>
                  <option value="GROUPS_ONLY">Group Heads Only</option>
                  <option value="POSTING_ONLY">Posting Accounts Only</option>
                </select>
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Showing {filteredAccounts.length} of {accounts.length} accounts
              </div>
            </div>

            {/* Hierarchical Table */}
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg">
              <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/80 uppercase font-semibold text-slate-500 text-[11px] border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Account Code</th>
                    <th className="py-2.5 px-3">Account Title &amp; Hierarchy</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Subtype</th>
                    <th className="py-2.5 px-3 text-center">Tier / Level</th>
                    <th className="py-2.5 px-3 text-center">Nature</th>
                    <th className="py-2.5 px-3 text-center">Account Class</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                  {filteredAccounts.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                        {loading ? "Loading Chart of Accounts..." : "No matching accounts found."}
                      </td>
                    </tr>
                  ) : (
                    filteredAccounts.map((acc) => {
                      const indentClass =
                        acc.level === 1
                          ? "pl-2 font-bold text-slate-900 dark:text-white text-sm"
                          : acc.level === 2
                          ? "pl-6 font-semibold text-slate-800 dark:text-slate-100"
                          : acc.level === 3
                          ? "pl-10 font-medium text-slate-700 dark:text-slate-200"
                          : "pl-14 text-slate-600 dark:text-slate-300";

                      return (
                        <tr
                          key={acc.id}
                          className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                            acc.is_group ? "bg-slate-50/30 dark:bg-slate-900/30" : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-brand-navy dark:text-brand-gold">
                            {acc.code}
                          </td>
                          <td className={`py-2.5 px-3 font-sans ${indentClass} flex items-center gap-1.5`}>
                            {acc.is_group ? (
                              <Layers className="w-3.5 h-3.5 text-brand-primary shrink-0" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 inline-block shrink-0" />
                            )}
                            {acc.name}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                acc.type === "ASSET"
                                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200"
                                  : acc.type === "LIABILITY"
                                  ? "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/60 dark:text-brand-gold border border-brand-gold/40"
                                  : acc.type === "EQUITY"
                                  ? "bg-brand-light text-brand-navy dark:bg-brand-navy/60 dark:text-brand-primary border border-brand-primary/30"
                                  : acc.type === "REVENUE"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200"
                              }`}
                            >
                              {acc.type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-sans text-slate-500 text-[11px]">
                            {acc.subtype || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300">
                              Tier {acc.level}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold text-[11px]">
                            <span className={getNormalBalance(acc.type) === "DEBIT" ? "text-blue-600" : "text-emerald-600"}>
                              {getNormalBalance(acc.type)}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge size="small" color={acc.is_group ? "purple" : "grey"}>
                              {acc.is_group ? "Group Head" : "Posting A/c"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <Badge size="small" color={acc.is_active ? "green" : "grey"}>
                              {acc.is_active ? "ACTIVE" : "INACTIVE"}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {!acc.is_group && (
                              <Button
                                size="small"
                                variant="secondary"
                                onClick={() => router.push(`/dashboard?tab=general_ledger`)}
                                className="h-6 px-2 text-[10px] font-sans"
                              >
                                Ledger <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DashboardErrorBoundary>
    </AdminShell>
  );
}

