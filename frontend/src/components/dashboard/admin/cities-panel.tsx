"use client";

import { useEffect, useState, useMemo, memo } from "react";
import {
  MapPin,
  Globe2,
  Building2,
  Trash2,
  RotateCw,
  Edit3,
  CheckCircle,
  AlertTriangle,
  Search,
  Filter,
  Plus,
  ShieldAlert,
  Archive,
  Store,
  Truck,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

interface CityItem {
  id: string;
  name: string;
  slug: string;
  state: string;
  state_id: string;
  state_code?: string;
  stateCode?: string;
  gst_state_code?: string;
  country: string;
  countryCode: string;
  timezone: string;
  currency: string;
  phoneCode: string;
  status: "active" | "archived";
  is_active: boolean;
  stats?: {
    branches?: number;
    zones?: number;
    pincodes?: number;
  };
}

interface StateItem {
  id: string;
  code: string;
  name: string;
  gst_state_code?: string;
  status?: string;
}

interface DependencyCheckResult {
  branchesCount: number;
  zonesCount: number;
  ordersCount: number;
  canDelete: boolean;
  cityName: string;
}

export const CitiesPanel = memo(function CitiesPanel() {
  const [cities, setCities] = useState<CityItem[]>([]);
  const [statesList, setStatesList] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStateFilter, setSelectedStateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");

  // Create / Edit Modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingCity, setEditingCity] = useState<CityItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formStateCode, setFormStateCode] = useState("");
  const [formStateName, setFormStateName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [submittingForm, setSubmittingForm] = useState(false);

  // Safe Removal / Dependency Modal
  const [showDepModal, setShowDepModal] = useState(false);
  const [depCity, setDepCity] = useState<CityItem | null>(null);
  const [depLoading, setDepLoading] = useState(false);
  const [deps, setDeps] = useState<DependencyCheckResult | null>(null);
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [citiesRes, statesRes] = await Promise.all([
        apiClient.getAdminCities().catch(() => ({ cities: [] })),
        apiClient.getAdminStates().catch(() => ({ states: [] })),
      ]);
      setCities(citiesRes?.cities || []);
      setStatesList(statesRes?.states || []);
    } catch (err: any) {
      setError(err.message || "Failed to load cities from database");
      setCities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Cities List
  const filteredCities = useMemo(() => {
    return cities.filter((c) => {
      // Status filter
      if (statusFilter === "active" && !c.is_active && c.status !== "active") return false;
      if (statusFilter === "archived" && (c.is_active || c.status === "active")) return false;

      // State filter
      if (selectedStateFilter !== "all") {
        const matchStateId = c.state_id === selectedStateFilter;
        const matchStateCode = (c.state_code || c.stateCode) === selectedStateFilter;
        const matchStateName = c.state?.toLowerCase() === selectedStateFilter.toLowerCase();
        if (!matchStateId && !matchStateCode && !matchStateName) return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = c.name?.toLowerCase().includes(q);
        const matchSlug = c.slug?.toLowerCase().includes(q);
        const matchState = c.state?.toLowerCase().includes(q);
        const matchCode = (c.state_code || c.stateCode || "").toLowerCase().includes(q);
        return matchName || matchSlug || matchState || matchCode;
      }

      return true;
    });
  }, [cities, statusFilter, selectedStateFilter, searchQuery]);

  // Open Add Modal
  const handleOpenCreate = () => {
    setEditingCity(null);
    setFormName("");
    setFormSlug("");
    setFormStateCode(statesList[0]?.code || "");
    setFormStateName(statesList[0]?.name || "");
    setFormIsActive(true);
    setShowFormModal(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (city: CityItem) => {
    setEditingCity(city);
    setFormName(city.name);
    setFormSlug(city.slug || city.id.replace(/^city_/, ""));
    setFormStateCode(city.state_code || city.stateCode || "");
    setFormStateName(city.state);
    setFormIsActive(city.is_active !== false && city.status !== "archived");
    setShowFormModal(true);
  };

  // Save City (Create / Update)
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast("City name is required", true);
      return;
    }
    if (!formStateCode && !formStateName) {
      showToast("Please select a state", true);
      return;
    }

    setSubmittingForm(true);
    try {
      const payload = {
        name: formName.trim(),
        slug: formSlug.trim() || formName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        state: formStateName,
        stateCode: formStateCode,
        is_active: formIsActive,
      };

      if (editingCity) {
        await apiClient.updateAdminCity(editingCity.id, payload);
        showToast(`City "${formName}" updated successfully in PostgreSQL.`);
      } else {
        await apiClient.createAdminCity(payload);
        showToast(`City "${formName}" created successfully in PostgreSQL.`);
      }

      setShowFormModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to save city", true);
    } finally {
      setSubmittingForm(false);
    }
  };

  // Archive / Disable Toggle
  const handleToggleActive = async (city: CityItem) => {
    const isCurrentlyActive = city.is_active !== false && city.status !== "archived";
    try {
      if (isCurrentlyActive) {
        await apiClient.archiveAdminCity(city.id);
        showToast(`City "${city.name}" disabled (hidden from storefront).`);
      } else {
        await apiClient.restoreAdminCity(city.id);
        showToast(`City "${city.name}" restored (enabled on storefront).`);
      }
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to update city status", true);
    }
  };

  // Open Safe Removal / Dependency Check Modal
  const handleOpenRemoval = async (city: CityItem) => {
    setDepCity(city);
    setDeps(null);
    setShowDepModal(true);
    setDepLoading(true);

    try {
      const res: any = await apiClient.getAdminCityDependencies(city.id);
      setDeps(res);
    } catch {
      setDeps({
        branchesCount: 0,
        zonesCount: 0,
        ordersCount: 0,
        canDelete: false,
        cityName: city.name,
      });
    } finally {
      setDepLoading(false);
    }
  };

  // Confirm Soft Delete (Only if zero dependencies)
  const handleConfirmDelete = async () => {
    if (!depCity) return;
    setActionLoading(true);
    try {
      const res: any = await apiClient.deleteAdminCity(depCity.id);
      if (res?.success === false || res?.error) {
        showToast(res.error || "Cannot delete city due to dependencies", true);
      } else {
        showToast(`City "${depCity.name}" removed safely.`);
        setShowDepModal(false);
        loadData();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete city", true);
    } finally {
      setActionLoading(false);
    }
  };

  // Quick Action: Archive from Removal Modal
  const handleArchiveFromModal = async () => {
    if (!depCity) return;
    setActionLoading(true);
    try {
      await apiClient.archiveAdminCity(depCity.id);
      showToast(`City "${depCity.name}" has been safely archived (disabled).`);
      setShowDepModal(false);
      loadData();
    } catch (err: any) {
      showToast(err.message || "Failed to archive city", true);
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
            <div className="w-10 h-10 rounded-xl bg-[#1D2F5D]/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-[#1D2F5D] dark:text-[#D4AF37]">
              <MapPin className="w-5 h-5 text-[#1D2F5D] dark:text-[#D4AF37]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[#1D2F5D] dark:text-white flex items-center gap-2">
                City & Municipality Master
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#1D2F5D]/10 text-[#1D2F5D] dark:bg-[#D4AF37]/20 dark:text-[#D4AF37]">
                  {cities.length} Registered
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authoritative multi-city registry mapped to state jurisdictions, bakery hubs, and delivery zones.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenCreate}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#1D2F5D] hover:bg-[#152347] dark:bg-[#D4AF37] dark:hover:bg-[#c49f2f] dark:text-slate-950 rounded-xl shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New City
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
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search by city name, state, or slug..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D2F5D]/30 dark:focus:ring-[#D4AF37]/30"
            />
          </div>

          {/* Filter by State */}
          <div className="sm:col-span-3">
            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              className="w-full py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1D2F5D]/30"
            >
              <option value="all">All States ({statesList.length})</option>
              {statesList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name} ({st.code})
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Status */}
          <div className="sm:col-span-3 flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            {(["all", "active", "archived"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg capitalize transition-all ${
                  statusFilter === s
                    ? "bg-white dark:bg-slate-900 text-[#1D2F5D] dark:text-[#D4AF37] shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Cities Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
            <RotateCw className="w-6 h-6 animate-spin text-[#1D2F5D] dark:text-[#D4AF37]" />
            Loading registered cities from PostgreSQL...
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-500 text-xs">{error}</div>
        ) : filteredCities.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No cities match the specified filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#1D2F5D]/5 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-[#1D2F5D] dark:text-slate-300 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-3.5 pl-5">City Name</th>
                  <th className="p-3.5">State & Jurisdiction</th>
                  <th className="p-3.5">URL Slug</th>
                  <th className="p-3.5">Hubs / Branches</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredCities.map((city) => {
                  const isActive = city.is_active !== false && city.status !== "archived";
                  return (
                    <tr
                      key={city.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="p-3.5 pl-5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-[#1D2F5D]/10 dark:bg-[#D4AF37]/10 flex items-center justify-center text-[#1D2F5D] dark:text-[#D4AF37] font-bold text-xs">
                            {city.name.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-xs">
                              {city.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{city.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
                          {city.state}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {city.state_code || city.stateCode || "IN"} • GST: {city.gst_state_code || "Linked"}
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        /{city.slug || city.id.replace(/^city_/, "")}
                      </td>

                      <td className="p-3.5">
                        {city.stats?.branches !== undefined ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                            <Store className="w-3.5 h-3.5 text-[#1D2F5D] dark:text-[#D4AF37]" />
                            {city.stats.branches} Hubs
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Dynamic</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                            isActive
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                              : "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                          />
                          {isActive ? "Active" : "Disabled"}
                        </span>
                      </td>

                      <td className="p-3.5 pr-5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenEdit(city)}
                            title="Edit City Details"
                            className="p-1.5 text-slate-600 hover:text-[#1D2F5D] dark:text-slate-300 dark:hover:text-[#D4AF37] hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Enable / Disable Button */}
                          <button
                            onClick={() => handleToggleActive(city)}
                            title={isActive ? "Disable City (Hide from Storefront)" : "Enable City"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              isActive
                                ? "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                                : "text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                          >
                            {isActive ? (
                              <Archive className="w-3.5 h-3.5" />
                            ) : (
                              <RotateCw className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {/* Safe Removal Button */}
                          <button
                            onClick={() => handleOpenRemoval(city)}
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

      {/* Create / Edit City Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-[#1D2F5D]/5 dark:bg-slate-800/50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-[#1D2F5D] dark:text-white flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#1D2F5D] dark:text-[#D4AF37]" />
                  {editingCity ? `Edit City: ${editingCity.name}` : "Add New Serviceable City"}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Direct PostgreSQL synchronization with statutory state linkage.
                </p>
              </div>
              <button
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    City Name *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (!editingCity) {
                        setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
                      }
                    }}
                    placeholder="e.g. Mysuru, Mangaluru"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1D2F5D]/30"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                    URL Slug *
                  </label>
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. mysuru"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-[#1D2F5D]/30"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Parent State / Union Territory *
                </label>
                <select
                  value={formStateCode}
                  onChange={(e) => {
                    const selCode = e.target.value;
                    setFormStateCode(selCode);
                    const matched = statesList.find((s) => s.code === selCode || s.id === selCode);
                    if (matched) {
                      setFormStateName(matched.name);
                    }
                  }}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-[#1D2F5D]/30"
                  required
                >
                  <option value="">-- Select State --</option>
                  {statesList.map((st) => (
                    <option key={st.id} value={st.code}>
                      {st.name} ({st.code} — GST: {st.gst_state_code || "N/A"})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="cityIsActive"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-[#1D2F5D] focus:ring-[#1D2F5D]"
                />
                <label htmlFor="cityIsActive" className="font-semibold text-slate-700 dark:text-slate-200">
                  Active (Visible on Storefront Location Selector & Checkout)
                </label>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingForm}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1D2F5D] hover:bg-[#152347] dark:bg-[#D4AF37] dark:hover:bg-[#c49f2f] dark:text-slate-950 rounded-xl shadow-xs disabled:opacity-50"
                >
                  {submittingForm ? "Saving..." : editingCity ? "Update City" : "Create City"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Removal / Dependency Checking Modal */}
      {showDepModal && depCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-bold text-sm">Dependency Safety Audit: {depCity.name}</h3>
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
                  <RotateCw className="w-5 h-5 animate-spin text-[#1D2F5D] dark:text-[#D4AF37]" />
                  Checking foreign key references across PostgreSQL branches, delivery zones, and customer orders...
                </div>
              ) : deps ? (
                <div className="space-y-4">
                  {/* Warning Box */}
                  {!deps.canDelete ? (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        Deletion Blocked: Active Operational Dependencies Found
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        The city <strong>{depCity.name}</strong> cannot be permanently deleted from the database
                        because existing business entities rely on it. Hard deleting would corrupt historical records and order tracking.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                        Zero Dependencies: Safe to Remove
                      </div>
                      <p className="text-[11px] leading-relaxed">
                        No operational bakery branches, delivery zones, or customer orders are attached to this record.
                        It can be removed safely without impacting historical operations.
                      </p>
                    </div>
                  )}

                  {/* Dependency Breakdown Cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <Store className="w-4 h-4 mx-auto text-[#1D2F5D] dark:text-[#D4AF37] mb-1" />
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {deps.branchesCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Kitchen Branches</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <Truck className="w-4 h-4 mx-auto text-blue-600 mb-1" />
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {deps.zonesCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Delivery Zones</div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-center">
                      <ShoppingBag className="w-4 h-4 mx-auto text-emerald-600 mb-1" />
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {deps.ordersCount}
                      </div>
                      <div className="text-[10px] text-slate-500">Linked Orders</div>
                    </div>
                  </div>

                  {/* Safest Option Recommendation */}
                  {!deps.canDelete && (
                    <div className="p-3.5 rounded-xl bg-[#1D2F5D]/5 dark:bg-[#D4AF37]/5 border border-[#1D2F5D]/15 dark:border-[#D4AF37]/15">
                      <div className="font-bold text-[#1D2F5D] dark:text-[#D4AF37] text-xs">
                        Recommended Action: Disable (Archive)
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                        Disabling the city hides it from the storefront location selector and prevents new checkout orders in this city, while 100% preserving historical customer addresses, past orders, and branch configurations.
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {/* Action Buttons */}
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
                      className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs flex items-center gap-1.5"
                    >
                      <Archive className="w-3.5 h-3.5" />
                      {actionLoading ? "Archiving..." : "Disable City (Safe Archive)"}
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
