"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Plus, Store, Trash2, MapPin, Phone, CheckCircle, AlertCircle, User, ShieldCheck, Clock, Truck, Sliders, Edit3, Cake, ShoppingBag, BarChart3, Lock, RefreshCw, AlertTriangle, Link2, RotateCw, Check, Search, Navigation, Loader2 } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { BranchPincodePanel } from "./branch-pincode-panel";
import { BranchProductAvailabilityModal } from "./branch-product-availability-modal";
import { BranchAccessoryInventoryModal } from "./branch-accessory-inventory-modal";
import { BranchOperationsModal } from "./branch-operations-modal";
import { BranchZoneProductRestrictionsModal } from "./branch-zone-product-restrictions-modal";
import { BranchComplianceModal } from "./compliance/branch-compliance-modal";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

const STORES_LIST = [];

export const BranchesPanel = memo(function BranchesPanel() {
  const [tab, setTab] = useState<"branches" | "pincodes">("branches");
  const [branches, setBranches] = useState<any[]>([]);
  const [gstRegistrations, setGstRegistrations] = useState<any[]>([]);
  const [complianceList, setComplianceList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lifecycleFilter, setLifecycleFilter] = useState<"active" | "archived" | "all">("active");
  const [confirmArchiveBranch, setConfirmArchiveBranch] = useState<any | null>(null);
  const [confirmRestoreBranch, setConfirmRestoreBranch] = useState<any | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Operational Modals
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);
  const [activeProductModalBranch, setActiveProductModalBranch] = useState<any | null>(null);
  const [activeAccessoryModalBranch, setActiveAccessoryModalBranch] = useState<any | null>(null);
  const [activeOperationsModalBranch, setActiveOperationsModalBranch] = useState<any | null>(null);
  const [activeZoneRestrictionsBranch, setActiveZoneRestrictionsBranch] = useState<any | null>(null);
  const [activeComplianceModalBranch, setActiveComplianceModalBranch] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [linkedStoreId, setLinkedStoreId] = useState("");
  const [branchType, setBranchType] = useState<string>("main_hub");
  const [extendedStatus, setExtendedStatus] = useState<string>("open");
  const [city, setCity] = useState("");
  const [cityId, setCityId] = useState("");
  const [citiesList, setCitiesList] = useState<any[]>([]);
  const [statesList, setStatesList] = useState<any[]>([]);
  const [stateId, setStateId] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [managerName, setManagerName] = useState("Rajesh Kumar");
  const [managerPhone, setManagerPhone] = useState("+91 98765 00001");
  const [managerEmail, setManagerEmail] = useState("manager@cakes2home.com");

  // Store Physical Location State
  const [latitude, setLatitude] = useState<number | string>("");
  const [longitude, setLongitude] = useState<number | string>("");
  const [locationSource, setLocationSource] = useState<string>("MANUAL_MAP");
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
  const [gpsLoading, setGpsLoading] = useState<boolean>(false);
  const [locationSearchQuery, setLocationSearchQuery] = useState<string>("");
  const [locationSearchResults, setLocationSearchResults] = useState<any[]>([]);
  const [searchingLocation, setSearchingLocation] = useState<boolean>(false);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchBranches = () => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.getAdminBranches().then((r: any) => setBranches(r?.branches || r?.data || [])),
      apiClient.getGstRegistrations().then((r: any) => setGstRegistrations(r?.registrations || [])).catch(() => {}),
      apiClient.getBranchCompliance().then((r: any) => setComplianceList(r?.compliance || [])).catch(() => {}),
    ])
      .catch((err) => {
        console.error("[Branches Panel Error] Failed to fetch branches:", err);
        setError(err.message || "Failed to load branch operations");
        setBranches([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBranches();
    Promise.all([
      apiClient.getCities().catch(() => ({ cities: [] })),
      apiClient.getAdminStates().catch(() => ({ states: [] })),
    ]).then(([citiesRes, statesRes]: any) => {
      setCitiesList(citiesRes?.cities || citiesRes || []);
      setStatesList(statesRes?.states || []);
    });
  }, []);

  const handleConfirmArchive = async () => {
    if (!confirmArchiveBranch?.id) return;
    setActionSubmitting(true);
    try {
      const res: any = await apiClient.archiveAdminBranch(confirmArchiveBranch.id);
      if (res.error) throw new Error(res.error);
      setConfirmArchiveBranch(null);
      setNotification({ message: `Store "${confirmArchiveBranch.name}" archived successfully.`, type: "success" });
      fetchBranches();
    } catch (err: any) {
      setNotification({ message: `Failed to archive store: ${err.message}`, type: "error" });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleConfirmRestore = async () => {
    if (!confirmRestoreBranch?.id) return;
    setActionSubmitting(true);
    try {
      const res: any = await apiClient.restoreAdminBranch(confirmRestoreBranch.id);
      if (res.error) throw new Error(res.error);
      setConfirmRestoreBranch(null);
      setNotification({ message: `Store "${confirmRestoreBranch.name}" restored successfully.`, type: "success" });
      fetchBranches();
    } catch (err: any) {
      setNotification({ message: `Failed to restore store: ${err.message}`, type: "error" });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingBranch(null);
    setFormError(null);
    setName("");
    setCode(`HUB-${Math.floor(100 + Math.random() * 900)}`);
    setLinkedStoreId("");
    setBranchType("main_hub");
    setExtendedStatus("open");
    setCity("");
    setCityId("");
    setStateId("");
    setState("");
    setPincode("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setLocationSource("MANUAL_MAP");
    setLocationAccuracy(null);
    setLocationSearchQuery("");
    setLocationSearchResults([]);
    setPhone("");
    setEmail(`branch_${Date.now()}@cakes2home.com`);
    setManagerName("");
    setManagerPhone("");
    setManagerEmail("");

    setShowModal(true);
  };

  const handleOpenEdit = (b: any) => {
    setEditingBranch(b);
    setFormError(null);
    setName(b.name || "");
    setCode(b.code || "");
    setLinkedStoreId(b.linked_store_id || "");
    setBranchType(b.branch_type || "main_hub");
    setExtendedStatus(b.extended_status || b.operational_status || "open");
    setCity(b.city || "");
    setCityId(b.city_id || "");
    // Resolve state from branch data or matching city
    const branchState = b.state || "";
    setState(branchState);
    const matchedState = statesList.find((s: any) => s.name === branchState || s.code === b.state_code);
    setStateId(b.state_id || matchedState?.id || "");
    setPincode(b.pincode || "");
    setAddress(b.address || "");
    setLatitude(typeof b.latitude === "number" ? b.latitude : "");
    setLongitude(typeof b.longitude === "number" ? b.longitude : "");
    setLocationSource(b.location_source || "MANUAL_MAP");
    setLocationAccuracy(b.location_accuracy ?? null);
    setLocationSearchQuery("");
    setLocationSearchResults([]);
    setPhone(b.phone || "");
    setEmail(b.email || "");
    setManagerName(b.manager_name || b.manager_account?.name || "");
    setManagerPhone(b.manager_account?.phone || b.phone || "");
    setManagerEmail(b.manager_account?.email || b.email || "");

    setShowModal(true);
  };

  const handleGpsCurrentLocation = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setNotification({ message: "Geolocation is not supported by your browser.", type: "error" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const acc = Math.round(pos.coords.accuracy || 10);
        setLatitude(lat);
        setLongitude(lng);
        setLocationSource("GPS");
        setLocationAccuracy(acc);
        try {
          const revRes: any = await apiClient.reverseGeocode(lat, lng);
          if (revRes?.formatted_address && !address) {
            setAddress(revRes.formatted_address);
          }
          if (revRes?.city && !city) {
            setCity(revRes.city);
          }
          if (revRes?.pincode && !pincode) {
            setPincode(revRes.pincode);
          }
        } catch {}
        setGpsLoading(false);
        setNotification({ message: `GPS Location acquired: ${lat}, ${lng} (±${acc}m)`, type: "success" });
      },
      (err) => {
        setGpsLoading(false);
        setNotification({ message: `Failed to acquire GPS: ${err.message}`, type: "error" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleLocationSearch = async (q: string) => {
    setLocationSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setLocationSearchResults([]);
      return;
    }
    setSearchingLocation(true);
    try {
      const res: any = await apiClient.searchDeliveryLocation(q.trim());
      setLocationSearchResults(res?.results || []);
    } catch {
      setLocationSearchResults([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  const handleToggleBranchOnline = async (branchId: string, isOnline: boolean) => {
    try {
      await apiClient.updateAdminBranch(branchId, {
        is_open: isOnline,
        extended_status: isOnline ? "open" : "closed",
        operational_status: isOnline ? "operational" : "temporarily_closed",
      });
      fetchBranches();
    } catch (err) {
      console.error("Failed to update branch status:", err);
    }
  };

  const handlePauseBranchOrders = async (branchId: string, durationMins: number) => {
    try {
      const pauseUntil = durationMins > 0 ? new Date(Date.now() + durationMins * 60 * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;
      await apiClient.updateAdminBranch(branchId, {
        is_paused: durationMins > 0,
        pause_until: pauseUntil,
        extended_status: durationMins > 0 ? "busy" : "open",
      });
      fetchBranches();
    } catch (err) {
      console.error("Failed to pause branch orders:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const trimmedCode = code.trim();
    if (!trimmedName) {
      setFormError("Hub / Branch name is required.");
      return;
    }
    if (!trimmedCode) {
      setFormError("Hub / Branch code is required.");
      return;
    }

    setSubmitting(true);

    const payload = {
      id: editingBranch?.id,
      code: trimmedCode,
      name: trimmedName,
      branch_type: branchType,
      extended_status: extendedStatus,
      operational_status: extendedStatus === "open" ? "operational" : extendedStatus === "busy" ? "busy" : "temporarily_closed",
      address: address.trim(),
      formatted_address: address.trim(),
      latitude: latitude !== "" && !isNaN(Number(latitude)) ? Number(Number(latitude).toFixed(6)) : undefined,
      longitude: longitude !== "" && !isNaN(Number(longitude)) ? Number(Number(longitude).toFixed(6)) : undefined,
      location_source: locationSource || "MANUAL_MAP",
      location_accuracy: locationAccuracy ?? null,
      city: city.trim(),
      city_id: cityId || undefined,
      state_id: stateId || undefined,
      state: state.trim(),
      pincode: pincode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      manager_name: managerName.trim(),
      manager_account: {
        name: managerName.trim(),
        phone: managerPhone.trim(),
        email: managerEmail.trim(),
        status: "active",
      },
      capacity_settings: editingBranch?.capacity_settings || {
        max_hourly_orders: 25,
        max_simultaneous_orders: 15,
        max_scheduled_orders: 50,
        max_express_orders: 20,
        max_midnight_orders: 15,
        busy_threshold: 80,
        emergency_stop: false,
        current_load: 0,
        auto_pause_enabled: true,
        is_auto_paused: false,
      },
      is_open: extendedStatus === "open" || extendedStatus === "busy" || extendedStatus === "accepting_scheduled_only",
      delivery_zones: editingBranch?.delivery_zones || [],
    };

    try {
      if (editingBranch?.id) {
        await apiClient.updateAdminBranch(editingBranch.id, payload);
        setNotification({ message: `Fulfillment Hub "${trimmedName}" updated successfully.`, type: "success" });
      } else {
        await apiClient.createAdminBranch(payload);
        setNotification({ message: `Fulfillment Hub "${trimmedName}" created successfully.`, type: "success" });
      }
      setShowModal(false);
      fetchBranches();
    } catch (err: any) {
      setFormError(err.message || "Failed to save fulfillment hub.");
    } finally {
      setSubmitting(false);
    }
  };

  const activeCount = branches.filter((b) => !b.is_archived && b.status !== "archived").length;
  const archivedCount = branches.filter((b) => b.is_archived || b.status === "archived").length;
  const totalCount = branches.length;

  const filteredBranches = branches.filter((b) => {
    const isArchived = b.is_archived || b.status === "archived";
    if (lifecycleFilter === "active") return !isArchived;
    if (lifecycleFilter === "archived") return isArchived;
    return true;
  });

  return (
    <WidgetErrorBoundary widgetName="Fulfillment Hub Operations Panel">
      <div className="space-y-6 font-sans">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
          <div>
            <Heading level="h2" className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
              <Store className="w-6 h-6 text-amber-600" /> Delivery Fulfillment Hub Operations
            </Heading>
            <Text className="text-xs text-ui-fg-subtle mt-1">
              Fulfillment Hub availability, cake availability overrides, and branch accessory inventory.
            </Text>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              color={tab === "branches" ? "purple" : "grey"}
              className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold"
              onClick={() => setTab("branches")}
            >
              Fulfillment Hubs ({branches.length})
            </Badge>
            <Badge
              color={tab === "pincodes" ? "purple" : "grey"}
              className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1"
              onClick={() => setTab("pincodes")}
            >
              <MapPin className="w-3.5 h-3.5" /> Area Matrix
            </Badge>

            {tab === "branches" && (
              <Button size="small" onClick={handleOpenCreate} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold ml-2">
                <Plus className="w-4 h-4" /> Create Fulfillment Hub
              </Button>
            )}
          </div>
        </div>

        {notification && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center justify-between transition ${
              notification.type === "success"
                ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                : "bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300"
            }`}
          >
            <span>{notification.type === "success" ? "✅" : "⚠️"} {notification.message}</span>
            <button onClick={() => setNotification(null)} className="text-xs font-bold hover:underline opacity-80">Dismiss</button>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <Button size="small" variant="secondary" onClick={fetchBranches}>Retry Fetch</Button>
          </div>
        )}

        {tab === "pincodes" ? (
          <BranchPincodePanel />
        ) : (
          <Container className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
              <Text className="font-semibold text-base text-slate-900 dark:text-white">
                Fulfillment Hubs Matrix ({filteredBranches.length})
              </Text>
              
              <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setLifecycleFilter("active")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    lifecycleFilter === "active" ? "bg-amber-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Store className="w-3.5 h-3.5" /> Active Stores ({activeCount})
                </button>
                <button
                  onClick={() => setLifecycleFilter("archived")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    lifecycleFilter === "archived" ? "bg-slate-800 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" /> Archived Stores ({archivedCount})
                </button>
                <button
                  onClick={() => setLifecycleFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    lifecycleFilter === "all" ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
                >
                  All ({totalCount})
                </button>
              </div>
            </div>

            {loading ? (
              <TableSkeleton rows={4} />
            ) : filteredBranches.length === 0 ? (
              <div className="text-center py-12 border border-dashed rounded-xl text-ui-fg-subtle">
                <Store className="w-10 h-10 mx-auto mb-2 opacity-40 text-amber-600" />
                <Text className="font-semibold text-sm">No delivery fulfillment hubs match the filter.</Text>
                <Text className="text-xs text-slate-500 mt-1">Try switching between Active and Archived filters.</Text>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredBranches.map((b) => {
                  const isArchived = b.is_archived || b.status === "archived";
                  const currentLoad = b.capacity_settings?.current_load ?? b.current_hourly_load ?? 0;
                  const maxHourly = b.capacity_settings?.max_hourly_orders ?? b.max_orders_per_hour ?? 25;
                  const loadPct = Math.min(100, Math.round((currentLoad / maxHourly) * 100));
                  const isAutoPaused = b.capacity_settings?.is_auto_paused || loadPct >= 100;

                  const statusColor = isArchived
                    ? "grey"
                    : isAutoPaused || b.extended_status === "busy"
                    ? "orange"
                    : b.extended_status === "open" || b.operational_status === "operational"
                    ? "green"
                    : "red";

                  const typeLabel =
                    b.branch_type === "main_hub"
                      ? "Main Hub"
                      : b.branch_type === "retail_outlet"
                      ? "Retail Outlet"
                      : b.branch_type === "franchise"
                      ? "Franchise"
                      : b.branch_type === "partner_bakery"
                      ? "Partner Bakery"
                      : "Pickup Point";

                  return (
                    <div key={b.id} className={`border rounded-xl p-5 bg-white dark:bg-slate-900 space-y-4 transition ${isArchived ? "border-slate-300 dark:border-slate-700 opacity-90 bg-slate-50/50" : "border-slate-200 dark:border-slate-800 hover:shadow-md"}`}>
                      {/* Top Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-slate-900 dark:text-white">{b.name}</span>
                            <Badge color="purple" className="text-[10px] font-extrabold">{b.code}</Badge>
                            <Badge color="blue" className="text-[10px]">{typeLabel}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{b.address}, {b.city} ({b.pincode})</span>
                            {typeof b.latitude === "number" && typeof b.longitude === "number" ? (
                              <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                                📍 {b.latitude.toFixed(4)}° N, {b.longitude.toFixed(4)}° E
                              </span>
                            ) : (
                              <Badge color="red" className="text-[9px] font-bold">
                                ⚠️ LOCATION REQUIRED
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge color={statusColor} className="capitalize font-bold text-xs">
                            {isArchived ? "ARCHIVED" : isAutoPaused ? "AUTO-PAUSED (HIGH LOAD)" : b.extended_status || b.operational_status || "Open"}
                          </Badge>
                        </div>
                      </div>

                      {/* Branch Manager Fast Operational Controls */}
                      {!isArchived && (
                        <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/50 rounded-xl space-y-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-purple-900 dark:text-purple-200 text-[11px] flex items-center gap-1.5">
                              <Sliders className="w-3.5 h-3.5 text-purple-600" /> Manager Operational Control & Quick Pause
                            </span>
                            <Badge color={b.is_paused ? "orange" : b.is_open !== false ? "green" : "red"} className="text-[9px]">
                              {b.is_paused ? `PAUSED (${b.pause_until || "Timer"})` : b.is_open !== false ? "ONLINE" : "OFFLINE"}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between gap-1 pt-1 border-t border-purple-200/50">
                            <button
                              onClick={() => handleToggleBranchOnline(b.id, b.is_open === false)}
                              className={`px-2 py-1 rounded text-[10px] font-bold ${b.is_open !== false ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}
                            >
                              {b.is_open !== false ? "🛑 Go Offline" : "✅ Go Online"}
                            </button>
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 font-medium">Pause:</span>
                              <button onClick={() => handlePauseBranchOrders(b.id, 15)} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold">15m</button>
                              <button onClick={() => handlePauseBranchOrders(b.id, 30)} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold">30m</button>
                              <button onClick={() => handlePauseBranchOrders(b.id, 60)} className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 hover:bg-amber-500 hover:text-white rounded text-[10px] font-bold">60m</button>
                              {b.is_paused && (
                                <button onClick={() => handlePauseBranchOrders(b.id, 0)} className="px-1.5 py-0.5 bg-emerald-600 text-white rounded text-[10px] font-bold">Resume</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Metadata Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Assigned Branch Manager:</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{b.manager_account?.name || b.manager_name || "Manager"}</span>
                            <Badge color={b.manager_account?.status === "suspended" ? "red" : "green"} className="text-[9px] px-1 py-0 capitalize font-bold">
                              {b.manager_account?.status || "Active"}
                            </Badge>
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Manager Phone / Contact:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">{b.manager_account?.phone || b.phone}</span>
                        </div>
                      </div>

                      {/* Delivery Zone Coverage Summary */}
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold">Delivery Zones:</span>
                          <span className="font-bold text-slate-900 dark:text-white font-mono">
                            {(b.delivery_zones || []).length} Zone{(b.delivery_zones || []).length !== 1 ? "s" : ""} Configured
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold">Coverage Pincodes:</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                            {(b.delivery_zones || []).reduce((acc: number, z: any) => acc + (Array.isArray(z.pincodes) ? z.pincodes.length : 0), 0)} Pincodes
                          </span>
                        </div>
                      </div>

                      {/* Operational Actions Row */}
                      {isArchived ? (
                        <div className="pt-3 border-t flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500 italic">
                            Archived {b.archived_at ? `on ${new Date(b.archived_at).toLocaleDateString()}` : "store record"}
                          </span>
                          <div className="flex items-center gap-2">
                            <Button size="small" variant="secondary" onClick={() => handleOpenEdit(b)} className="text-[11px] font-bold">
                              <Edit3 className="w-3.5 h-3.5 mr-1" /> View / Edit Details
                            </Button>
                            <Button size="small" variant="secondary" onClick={() => setConfirmRestoreBranch(b)} className="text-[11px] font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40">
                              <RotateCw className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Restore Store
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-3 border-t grid grid-cols-2 sm:grid-cols-7 gap-1.5">
                          <Button size="small" variant="secondary" onClick={() => setActiveOperationsModalBranch(b)} className="text-[11px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40">
                            <Clock className="w-3.5 h-3.5 mr-1 text-rose-600" /> Operations
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setActiveComplianceModalBranch(b)} className="text-[11px] font-bold text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Compliance
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setActiveZoneRestrictionsBranch(b)} className="text-[11px] font-bold text-rose-700 bg-rose-50/70 dark:bg-rose-950/40">
                            <ShieldCheck className="w-3.5 h-3.5 mr-1 text-rose-600" /> Zone Rules
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setActiveProductModalBranch(b)} className="text-[11px] font-bold">
                            <Cake className="w-3.5 h-3.5 mr-1 text-amber-600" /> Products
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setActiveAccessoryModalBranch(b)} className="text-[11px] font-bold">
                            <ShoppingBag className="w-3.5 h-3.5 mr-1 text-purple-600" /> Accessories
                          </Button>
                          <Button size="small" variant="transparent" onClick={() => handleOpenEdit(b)} className="text-[11px] font-bold text-blue-600">
                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Hub
                          </Button>
                          <Button size="small" variant="transparent" onClick={() => setConfirmArchiveBranch(b)} className="text-[11px] font-bold text-slate-600 hover:text-amber-700 hover:bg-amber-50">
                            <Lock className="w-3.5 h-3.5 mr-1 text-amber-600" /> Archive
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Container>
        )}

      {/* Archive Confirmation Modal */}
      {confirmArchiveBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="w-7 h-7 shrink-0" />
              <Heading level="h3" className="text-lg font-bold text-slate-900 dark:text-white">Archive Store?</Heading>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will stop <strong>{confirmArchiveBranch.name}</strong> from accepting new orders and remove it from active branch operations. Existing orders, invoices, KOTs, reports, staff accounts, and historical records will be preserved.
            </p>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 rounded-lg text-[11px] text-amber-800 dark:text-amber-300">
              ℹ️ Archiving does not delete any database records. You can restore this store at any time.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="transparent" onClick={() => setConfirmArchiveBranch(null)}>Cancel</Button>
              <Button onClick={handleConfirmArchive} isLoading={actionSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                Archive Store
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Confirmation Modal */}
      {confirmRestoreBranch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <RotateCw className="w-7 h-7 shrink-0" />
              <Heading level="h3" className="text-lg font-bold text-slate-900 dark:text-white">Restore Store?</Heading>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will make <strong>{confirmRestoreBranch.name}</strong> available for active operations again. Delivery zones, operating hours and product availability should be reviewed before accepting orders.
            </p>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 rounded-lg text-[11px] text-emerald-800 dark:text-emerald-300">
              ✅ Store configuration, delivery zones, and product inventory settings will be restored intact.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t">
              <Button variant="transparent" onClick={() => setConfirmRestoreBranch(null)}>Cancel</Button>
              <Button onClick={handleConfirmRestore} isLoading={actionSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                Restore Store
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Availability Modal */}
      {activeProductModalBranch && (
        <BranchProductAvailabilityModal
          branch={activeProductModalBranch}
          onClose={() => setActiveProductModalBranch(null)}
        />
      )}

      {/* Accessory Physical Inventory Modal */}
      {activeAccessoryModalBranch && (
        <BranchAccessoryInventoryModal
          branch={activeAccessoryModalBranch}
          onClose={() => setActiveAccessoryModalBranch(null)}
        />
      )}

      {/* Branch Store Operations Modal */}
      {activeOperationsModalBranch && (
        <BranchOperationsModal
          branch={activeOperationsModalBranch}
          onClose={() => setActiveOperationsModalBranch(null)}
          onSaved={fetchBranches}
        />
      )}

      {/* Zone Delivery Restrictions Modal */}
      {activeZoneRestrictionsBranch && (
        <BranchZoneProductRestrictionsModal
          branch={activeZoneRestrictionsBranch}
          onClose={() => setActiveZoneRestrictionsBranch(null)}
        />
      )}

      {/* Branch Compliance Modal */}
      {activeComplianceModalBranch && (
        <BranchComplianceModal
          branch={activeComplianceModalBranch}
          compliance={complianceList.find((c) => c.branch_id === activeComplianceModalBranch.id)}
          gstRegistrations={gstRegistrations}
          onClose={() => setActiveComplianceModalBranch(null)}
          onSaved={() => {
            setActiveComplianceModalBranch(null);
            fetchBranches();
          }}
        />
      )}

      {/* Create / Edit Fulfillment Hub Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-8">
            <div className="p-4 border-b flex items-center justify-between bg-amber-50 dark:bg-amber-950/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Store className="w-5 h-5 text-amber-600" />
                {editingBranch ? `Configure Hub: ${editingBranch.name}` : "Create Delivery Fulfillment Hub"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              {formError && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-rose-800 dark:text-rose-300 flex items-center justify-between text-xs">
                  <span>⚠️ {formError}</span>
                  <button type="button" onClick={() => setFormError(null)} className="text-xs font-bold hover:underline opacity-80">Dismiss</button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Hub Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HSR Layout Delivery Hub" required />
                </div>
                <div>
                  <Label>Hub Code *</Label>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HUB-BLR-01" required />
                </div>

                <div>
                  <Label>Branch / Hub Type *</Label>
                  <select
                    value={branchType}
                    onChange={(e) => setBranchType(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="main_hub">Main Hub</option>
                    <option value="retail_outlet">Retail Outlet</option>
                    <option value="franchise">Franchise</option>
                    <option value="partner_bakery">Partner Bakery</option>
                    <option value="pickup_point">Pickup Point</option>
                  </select>
                </div>

                <div>
                  <Label>Extended Operational Status</Label>
                  <select
                    value={extendedStatus}
                    onChange={(e) => setExtendedStatus(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="open">Open (Active)</option>
                    <option value="busy">Busy (High Load Auto-Pause)</option>
                    <option value="accepting_scheduled_only">Accepting Scheduled Orders Only</option>
                    <option value="closed">Closed</option>
                    <option value="holiday">Holiday</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="emergency_closed">Emergency Closed</option>
                  </select>
                </div>

                <div>
                  <Label>State *</Label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900"
                    value={stateId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setStateId(selectedId);
                      const match = statesList.find((s: any) => s.id === selectedId);
                      if (match) {
                        setState(match.name);
                      } else {
                        setState("");
                      }
                      // Reset city when state changes
                      setCityId("");
                      setCity("");
                    }}
                    required
                  >
                    <option value="">Select State...</option>
                    {statesList.filter((s: any) => s.status === "active").map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label>City *</Label>
                  <select
                    className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-900"
                    value={cityId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setCityId(selectedId);
                      const match = citiesList.find((c: any) => c.id === selectedId);
                      if (match) {
                        setCity(match.name);
                        // Auto-fill state if not already set
                        if (!stateId && match.state_id) {
                          setStateId(match.state_id);
                          setState(match.state || "");
                        }
                      } else {
                        setCity("");
                      }
                    }}
                    required
                    disabled={!stateId}
                  >
                    <option value="">{stateId ? "Select City..." : "Select State first..."}</option>
                    {citiesList
                      .filter((c: any) => c.status === "active" && (!stateId || c.state_id === stateId))
                      .map((c: any) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                  </select>
                </div>
                <div>
                  <Label>Primary Pincode *</Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} placeholder="e.g. 560038" required />
                </div>

                <div className="sm:col-span-2">
                  <Label>Full Street Address *</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full street address" required />
                </div>

                {/* ── STORE PHYSICAL LOCATION & COORDINATES SECTION ── */}
                <div className="sm:col-span-2 p-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 dark:from-slate-800 dark:to-slate-800/90 rounded-xl border border-amber-300 dark:border-slate-700 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <Label className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-amber-600" /> Store Physical Location &amp; Coordinates *
                      </Label>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Delivery radius, distance pricing, and customer serviceability originate strictly from these coordinates.
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        size="small"
                        variant="secondary"
                        onClick={handleGpsCurrentLocation}
                        disabled={gpsLoading}
                        className="text-[11px] font-bold gap-1 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600"
                      >
                        {gpsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Navigation className="w-3.5 h-3.5 text-blue-600" />}
                        Use Current Location
                      </Button>
                    </div>
                  </div>

                  {/* Location Search Helper */}
                  <div className="relative">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="text"
                        value={locationSearchQuery}
                        onChange={(e) => handleLocationSearch(e.target.value)}
                        placeholder="🔍 Search area, landmark, or street to auto-fill coordinates..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      {searchingLocation && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-amber-500 animate-spin" />}
                    </div>
                    {locationSearchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {locationSearchResults.map((r: any, idx: number) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              const lat = typeof r.latitude === "number" ? r.latitude : (typeof r.lat === "number" ? r.lat : 0);
                              const lng = typeof r.longitude === "number" ? r.longitude : (typeof r.lng === "number" ? r.lng : 0);
                              if (lat && lng) {
                                setLatitude(lat);
                                setLongitude(lng);
                                setLocationSource("SEARCH");
                                if (r.label || r.formatted_address) {
                                  if (!address) setAddress(r.label || r.formatted_address);
                                }
                                if (r.city && !city) setCity(r.city);
                                if (r.pincode && !pincode) setPincode(r.pincode);
                              }
                              setLocationSearchResults([]);
                              setLocationSearchQuery("");
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-amber-50 dark:hover:bg-slate-800 flex items-center justify-between"
                          >
                            <span className="truncate font-medium">{r.label || r.formatted_address || r.area_name}</span>
                            <span className="text-[10px] text-amber-600 font-bold shrink-0 ml-2">Apply Coords</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px]">Latitude (e.g. 12.971600) *</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(e) => {
                          setLatitude(e.target.value);
                          setLocationSource("MANUAL_MAP");
                        }}
                        placeholder="12.971600"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Longitude (e.g. 77.594600) *</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(e) => {
                          setLongitude(e.target.value);
                          setLocationSource("MANUAL_MAP");
                        }}
                        placeholder="77.594600"
                        required
                      />
                    </div>
                    <div>
                      <Label className="text-[11px]">Location Source</Label>
                      <select
                        value={locationSource}
                        onChange={(e) => setLocationSource(e.target.value)}
                        className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs bg-white dark:bg-slate-900"
                      >
                        <option value="GPS">GPS Geolocation</option>
                        <option value="SEARCH">Address Search</option>
                        <option value="MANUAL_MAP">Manual Map Placement</option>
                        <option value="ADDRESS_GEOCODE">Address Geocode</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Manager Full Name *</Label>
                  <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="e.g. Rajesh Kumar" required />
                </div>
                <div>
                  <Label>Manager Phone *</Label>
                  <Input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="+91 98765 00001" required />
                </div>
                <div className="sm:col-span-2">
                  <Label>Manager Email *</Label>
                  <Input value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@cakes2home.com" required />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold">
                  Save Store / Fulfillment Hub
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

