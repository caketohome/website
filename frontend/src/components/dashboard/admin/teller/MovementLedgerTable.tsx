"use client";

import React, { useState, useMemo } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  RefreshCw,
  FileText,
  Clock,
  Layers,
} from "lucide-react";
import type { TellerMovementRow } from "@frontend/lib/types/teller.types";

interface MovementLedgerTableProps {
  movements: TellerMovementRow[];
  loading?: boolean;
  onRefresh?: () => void;
  expectedCash?: number | null;
  openingFloat?: number | null;
}

export function MovementLedgerTable({
  movements,
  loading = false,
  onRefresh,
  expectedCash,
  openingFloat,
}: MovementLedgerTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      if (directionFilter !== "ALL" && m.direction !== directionFilter) {
        return false;
      }
      if (typeFilter !== "ALL" && m.movement_type !== typeFilter) {
        return false;
      }
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const narration = (m.narration || "").toLowerCase();
        const sourceId = (m.source_id || "").toLowerCase();
        const sourceType = (m.source_type || "").toLowerCase();
        const id = m.id.toLowerCase();
        return (
          narration.includes(q) ||
          sourceId.includes(q) ||
          sourceType.includes(q) ||
          id.includes(q)
        );
      }
      return true;
    });
  }, [movements, directionFilter, typeFilter, searchTerm]);

  const formatAmount = (val: number | string) => {
    const num = Number(val);
    return isNaN(num) ? "0.00" : num.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    } catch {
      return ts;
    }
  };

  const getMovementTypeBadge = (type: string) => {
    switch (type) {
      case "ADJUSTMENT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">Adjustment</span>;
      case "CASH_SALE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">Cash Sale</span>;
      case "COD_HANDOVER":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">COD Handover</span>;
      case "CUSTOMER_REFUND":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-800 border border-purple-200">Customer Refund</span>;
      case "EXPENSE_PAYMENT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200">Expense Payment</span>;
      case "BANK_DEPOSIT":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-800 border border-indigo-200">Bank Deposit</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">{type}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header & Controls */}
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-slate-500" />
            Cash Custody Movement Ledger
            <span className="text-xs font-normal text-slate-500">
              ({filteredMovements.length} {filteredMovements.length === 1 ? "entry" : "entries"})
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit register of physical cash inflows and outflows in this shift
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search narration, ref..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Direction Filter */}
          <select
            value={directionFilter}
            onChange={(e) => setDirectionFilter(e.target.value as any)}
            className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Directions</option>
            <option value="IN">Cash IN (+)</option>
            <option value="OUT">Cash OUT (-)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-xs py-1.5 px-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Movement Types</option>
            <option value="ADJUSTMENT">Adjustments</option>
            <option value="CASH_SALE">Cash Sales</option>
            <option value="COD_HANDOVER">COD Handovers</option>
            <option value="CUSTOMER_REFUND">Refunds</option>
            <option value="EXPENSE_PAYMENT">Expenses</option>
            <option value="BANK_DEPOSIT">Bank Deposits</option>
          </select>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
              title="Refresh ledger"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-2.5 px-4">Time</th>
              <th className="py-2.5 px-4">Direction</th>
              <th className="py-2.5 px-4">Type</th>
              <th className="py-2.5 px-4 text-right">Amount (₹)</th>
              <th className="py-2.5 px-4">Source / Reference</th>
              <th className="py-2.5 px-4">Narration</th>
              <th className="py-2.5 px-4">Operator</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {filteredMovements.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-medium text-slate-600">No cash movements recorded yet</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Physical collections, handovers, and adjustments will appear in this ledger
                  </p>
                </td>
              </tr>
            ) : (
              filteredMovements.map((m) => {
                const isIn = m.direction === "IN";
                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap flex items-center gap-1.5 font-mono text-[11px]">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {formatTime(m.created_at)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {isIn ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <ArrowDownLeft className="w-3 h-3" />
                          IN
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                          <ArrowUpRight className="w-3 h-3" />
                          OUT
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      {getMovementTypeBadge(m.movement_type)}
                    </td>
                    <td className={`py-2.5 px-4 text-right font-mono font-semibold whitespace-nowrap ${isIn ? "text-emerald-700" : "text-rose-700"}`}>
                      {isIn ? "+" : "-"}₹{formatAmount(m.amount)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-[11px] whitespace-nowrap">
                      {m.source_type ? (
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">
                          {m.source_type}: {m.source_id || "N/A"}
                        </span>
                      ) : (
                        <span className="text-slate-400">Manual Entry</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700 max-w-xs truncate" title={m.narration || ""}>
                      {m.narration || "—"}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] whitespace-nowrap">
                      {m.created_by}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
