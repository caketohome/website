"use client";

import React, { useState } from "react";
import {
  Building,
  Plus,
  Search,
  RefreshCw,
  Power,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  X,
  UserCheck,
} from "lucide-react";
import type { TellerRow } from "@frontend/lib/types/teller.types";

interface TellerMasterTabProps {
  tellers: TellerRow[];
  loading: boolean;
  onRefresh: () => void;
  branches: { id: string; name: string }[];
  selectedBranchId: string;
  onSelectBranch: (id: string) => void;
}

export function TellerMasterTab({
  tellers,
  loading,
  onRefresh,
  branches,
  selectedBranchId,
  onSelectBranch,
}: TellerMasterTabProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);

  const handleCreateTeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !userId.trim()) {
      setError("Please complete all required fields.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/tellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim().toUpperCase(),
          user_id: userId.trim(),
          branch_id: selectedBranchId,
          status: "ACTIVE",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || data.error || "Failed to create teller station.");
        return;
      }

      setShowAddModal(false);
      setName("");
      setCode("");
      setUserId("");
      onRefresh();
    } catch (err: any) {
      setError(err.message || "Network error while creating teller.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (teller: TellerRow) => {
    const newStatus = teller.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setToggleLoading(teller.id);
    try {
      const res = await fetch(`/api/v1/admin/tellers/${teller.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        onRefresh();
      } else {
        alert(data.message || "Failed to update teller status.");
      }
    } catch (err: any) {
      alert(err.message || "Network error updating status.");
    } finally {
      setToggleLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Building className="w-5 h-5 text-indigo-600" />
            Teller Counter Stations Management
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure physical till stations and assign cash custody operators
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Branch Picker */}
          <select
            value={selectedBranchId}
            onChange={(e) => onSelectBranch(e.target.value)}
            className="text-xs py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Counter</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 transition-colors disabled:opacity-50"
            title="Refresh tellers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Grid of Counters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tellers.length === 0 ? (
          <div className="col-span-full bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <Building className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="text-sm font-semibold text-slate-700">No Counter Stations Configured</p>
            <p className="text-xs text-slate-400 mt-1">
              Add a teller counter to allow staff to open and operate cash shifts.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Station</span>
            </button>
          </div>
        ) : (
          tellers.map((t) => {
            const isActive = t.status === "ACTIVE";
            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {t.code}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-100 text-slate-500 border border-slate-200"
                      }`}
                    >
                      {isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {t.status}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-slate-800">{t.name}</h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">{t.id}</p>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-slate-400" />
                    <div>
                      <span className="text-[10px] text-slate-400 block">Operator</span>
                      <span className="font-medium text-slate-700">{t.user_id}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleStatus(t)}
                    disabled={toggleLoading === t.id}
                    className={`p-1.5 rounded-lg border text-xs transition-colors ${
                      isActive
                        ? "text-rose-600 border-rose-200 hover:bg-rose-50"
                        : "text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                    }`}
                    title={isActive ? "Deactivate Station" : "Activate Station"}
                  >
                    {toggleLoading === t.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Power className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add Counter Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-indigo-50/40">
              <h3 className="text-base font-bold text-slate-800">Add Counter Station</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTeller} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Station Code <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T1, CASH-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono uppercase bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Station Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Main Cash Desk 1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned User ID <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. usr_123 or cashier username"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Each user can only be actively assigned to at most one teller counter across the company.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm flex items-center gap-1.5"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Station</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
