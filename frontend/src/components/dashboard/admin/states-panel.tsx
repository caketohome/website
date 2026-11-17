"use client";

import { useEffect, useState, useMemo, memo } from "react";
import {
  Globe2,
  ShieldCheck,
  RotateCw,
  Plus,
  Edit3,
  Trash2,
  Archive,
  Search,
  CheckCircle,
  AlertTriangle,
  ShieldAlert,
  MapPin,
  Store,
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface StateItem {
  id: string;
  code: string;
  name: string;
  gst_state_code?: string;
  country_id?: string;
  country_code?: string;
  timezone?: string;
  currency?: string;
  currency_symbol?: string;
  status?: "active" | "archived";
  display_order?: number;
}

interface StateDependencyCheckResult {
  citiesCount: number;
  branchesCount: number;
  canDelete: boolean;
  stateName: string;
}

export const StatesPanel = memo(function StatesPanel() {
  const [states, setStates] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Create / Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingState, setEditingState] = useState<StateItem | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gstStateCode, setGstStateCode] = useState("");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [submitting, setSubmitting] = useState(false);

  // Safe Removal Modal
  const [showDepModal, setShowDepModal] = useState(false);
  const [depState, setDepState] = useState<StateItem | null>(null);
  const [depLoading, setDepLoading] = useState(false);
  const [deps, setDeps] = useState<StateDependencyCheckResult | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Notifications
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const showToast = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg);
      setTimeout(() => setErrorMsg(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const fetchStates = async () => {
    setLoading(true);
    setError(null);
    try {
      const res: any = await apiClient.getAdminStates();
      setStates(res?.states || []);
    } catch (err: any) {
      setError(err.message || "Failed to load states from database");
      setStates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
  }, []);

  // Filtered list
  const filteredStates = useMemo(() => {
    return states.filter((s) => {
      const st = s.status || "active";
      if (statusFilter === "active" && st !== "active") return false;
      if (statusFilter === "archived" && st !== "archived") return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = s.name?.toLowerCase().includes(q);
        const matchCode = s.code?.toLowerCase().includes(q);
        const matchGst = s.gst_state_code?.toLowerCase().includes(q);
        return matchName || matchCode || matchGst;
      }
      return true;
    });
  }, [states, statusFilter, searchQuery]);

  const handleOpenCreate = () => {
    setEditingState(null);
    setName("");
    setCode("");
    setGstStateCode("");
    setDisplayOrder(String(states.length + 1));
    setShowModal(true);
  };

  const handleOpenEdit = (st: StateItem) => {
    setEditingState(st);
    setName(st.name || "");
    setCode(st.code || "");
    setGstStateCode(st.gst_state_code || "");
    setDisplayOrder(String(st.display_order || 1));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      showToast("State Name and 2-letter Code are required.", true);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim().toUpperCase(),
        gst_state_code: gstStateCode.trim(),
        country_id: "country_in",
        country_code: "IN",
        timezone: "Asia/Kolkata",
        currency: "INR",
        currency_symbol: "₹",
        display_order: Number(displayOrder) || 1,
      };

      if (editingState) {
        await apiClient.updateAdminState(editingState.id, payload);
        showToast(`State "${name}" updated successfully in PostgreSQL.`);
      } else {
        await apiClient.createAdminState(payload);
        showToast(`State "${name}" registered successfully in PostgreSQL.`);
      }

      setShowModal(false);
      fetchStates();
    } catch (err: any) {
      showToast(err.message || "Failed to save state", true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (st: StateItem) => {
    const isCurrentlyActive = (st.status || "active") === "active";
    try {
      if (isCurrentlyActive) {
        await apiClient.archiveAdminState(st.id);
        showToast(`State "${st.name}" disabled (archived).`);
      } else {
        await apiClient.restoreAdminState(st.id);
        showToast(`State "${st.name}" restored to active status.`);
      }
      fetchStates();
    } catch (err: any) {
      showToast(err.message || "Failed to update state status", true);
    }
  };

  // Open Safe Removal Modal
  const handleOpenRemoval = async (st: StateItem) => {
    setDepState(st);
    setDeps(null);
    setShowDepModal(true);
    setDepLoading(true);

    try {
      const res: any = await apiClient.getAdminStateDependencies(st.id);
      setDeps(res);
    } catch {
      setDeps({
        citiesCount: 0,
        branchesCount: 0,
        canDelete: false,
        stateName: st.name,
      });
    } finally {
      setDepLoading(false);
    }
  };

  // Confirm Soft Delete (Only if zero dependencies)
  const handleConfirmDelete = async () => {
    if (!depState) return;
    setActionLoading(true);
    try {
      const res: any = await apiClient.deleteAdminState(depState.id);
      if (res?.success === false || res?.error) {
        showToast(res.error || "Cannot delete state due to dependencies", true);
      } else {
        showToast(`State "${depState.name}" removed safely.`);
        setShowDepModal(false);
        fetchStates();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete state", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Action: Archive from Removal Modal
  const handleArchiveFromModal = async () => {
    if (!depState) return;
    setActionLoading(true);
    try {
      await apiClient.archiveAdminState(depState.id);
      showToast(`State "${depState.name}" has been safely archived.`);
      setShowDepModal(false);
      fetchStates();
    } catch (err: any) {
      showToast(err.message || "Failed to archive state", true);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-navy/10 dark:bg-brand-gold/10 flex items-center justify-center text-brand-navy dark:text-brand-gold">
              <Globe2 className="w-5 h-5 text-brand-navy dark:text-brand-gold" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-navy dark:text-white flex items-center gap-2">
                State & Territory Master Registry
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-navy/10 text-brand-navy dark:bg-brand-gold/20 dark:text-brand-gold">
                  {states.length} States / UTs
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authoritative registry of Indian States & UTs with statutory GST place-of-supply codes and tax bindings.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchStates}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-deep dark:bg-brand-gold dark:hover:bg-[#c49f2f] dark:text-slate-950 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add State / UT
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Filters and Controls */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Box */}
          <div className="sm:col-span-8 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by state name, 2-letter code (e.g. KA, MH), or GST code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-navy/30 dark:focus:ring-brand-gold/30"
            />
          </div>

          {/* Filter by Status */}
          <div className="sm:col-span-4 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["all", "active", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all ${
                  statusFilter === s
                    ? "bg-white dark:bg-slate-900 text-brand-navy dark:text-brand-gold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* States Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RotateCw className="w-6 h-6 animate-spin text-brand-navy dark:text-brand-gold" />
            Loading registered states from PostgreSQL...
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 text-xs">{error}</div>
        ) : filteredStates.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No states match the specified filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-brand-navy/5 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-brand-navy dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">Order</th>
                  <th className="p-3.5">State / UT Name</th>
                  <th className="p-3.5">State Code</th>
                  <th className="p-3.5">GST Code</th>
                  <th className="p-3.5">Country</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredStates.map((st) => {
                  const isActive = (st.status || "active") === "active";
                  return (
                    <tr
                      key={st.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 pl-5 text-slate-400 font-mono text-[11px]">
                        {st.display_order || 1}
                      </td>

                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-brand-navy dark:text-brand-gold shrink-0" />
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {st.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{st.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono font-bold text-brand-navy dark:text-brand-gold">
                        {st.code}
                      </td>

                      <td className="p-3.5 font-mono font-semibold text-slate-700 dark:text-slate-300">
                        {st.gst_state_code ? `GST: ${st.gst_state_code}` : "—"}
                      </td>

                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        {st.country_code || "IN"}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/60 dark:text-brand-gold/40 border border-brand-gold/40 dark:border-brand-gold-dark"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-brand-gold"
                            }`}
                          />
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      <td className="p-3.5 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(st)}
                            title="Edit State Details"
                            className="p-1.5 text-slate-600 hover:text-brand-navy dark:text-slate-300 dark:hover:text-brand-gold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleToggleActive(st)}
                            title={isActive ? "Disable State" : "Enable State"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? "text-brand-gold hover:bg-brand-gold-light dark:hover:bg-brand-gold-dark/40"
                                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            {isActive ? (
                              <Archive className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenRemoval(st)}
                            title="Safe Remove / Dependency Check"
                            className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit State Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-brand-navy/5 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-brand-navy dark:text-white flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
                  {editingState ? `Edit State: ${editingState.name}` : "Register New State / UT"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Statutory GST and territory configuration in PostgreSQL.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    State / UT Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Karnataka, Kerala"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-navy/30"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    2-Letter State Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    maxLength={2}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. KA, KL, TN, MH"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-navy/30"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    GST State Code (2 Digits)
                  </label>
                  <input
                    type="text"
                    value={gstStateCode}
                    maxLength={2}
                    onChange={(e) => setGstStateCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 29 for KA, 32 for KL"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-brand-navy/30"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={displayOrder}
                    min={1}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-navy/30"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold text-white bg-brand-navy hover:bg-brand-deep dark:bg-brand-gold dark:hover:bg-[#c49f2f] dark:text-slate-950 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submitting ? "Saving..." : editingState ? "Save Changes" : "Register State"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Removal / Dependency Checking Modal */}
      {showDepModal && depState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">State Safety Audit: {depState.name}</h3>
              </div>
              <button
                onClick={() => setShowDepModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {depLoading ? (
                <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-brand-navy dark:text-brand-gold" />
                  Checking child cities and registered branches in this state...
                </div>
              ) : deps ? (
                <div className="space-y-4">
                  {!deps.canDelete ? (
                    <div className="p-4 rounded-xl bg-brand-gold-light dark:bg-brand-gold-dark/40 border border-brand-gold/40 dark:border-brand-gold-dark text-brand-gold-dark dark:text-brand-gold/40 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-brand-gold shrink-0" />
                        Deletion Blocked: Active Cities & Hubs Connected
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        The state <strong>{depState.name}</strong> cannot be deleted because child cities or kitchen branches are currently registered under it.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        Zero Dependencies: Safe to Remove
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        No registered cities or bakery hubs are attached to this state. It can be safely removed.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <MapPin className="w-4 h-4 mx-auto text-brand-navy dark:text-brand-gold mb-1" />
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {deps.citiesCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Child Cities</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <Store className="w-4 h-4 mx-auto text-brand-navy dark:text-brand-gold mb-1" />
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {deps.branchesCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Linked Branches</div>
                    </div>
                  </div>

                  {!deps.canDelete && (
                    <div className="p-3.5 rounded-xl bg-brand-navy/5 dark:bg-brand-gold/5 border border-brand-navy/15 dark:border-brand-gold/15">
                      <div className="font-bold text-brand-navy dark:text-brand-gold text-xs">
                        Recommended Action: Disable (Archive) State
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Archiving deactivates the state from new branch registrations and statutory selection while preserving all historical tax documents and linked branches.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowDepModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Close
                </button>

                <div className="flex items-center gap-2">
                  {deps && !deps.canDelete && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleArchiveFromModal}
                      className="px-4 py-2 text-xs font-bold text-white bg-brand-gold hover:bg-brand-gold-dark rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {actionLoading ? "Archiving..." : "Disable State (Safe Archive)"}
                    </button>
                  )}

                  {deps && deps.canDelete && (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={handleConfirmDelete}
                      className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {actionLoading ? "Removing..." : "Confirm Soft Delete"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
