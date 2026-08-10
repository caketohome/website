"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Plus, Store, Trash2, MapPin, Phone, CheckCircle, AlertCircle, User, ShieldCheck, Clock, Truck, Sliders, Edit3, Cake, ShoppingBag, BarChart3, Lock, RefreshCw, AlertTriangle, Link2, RotateCw, Check } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { BranchPincodePanel } from "./branch-pincode-panel";
import { BranchProductAvailabilityModal } from "./branch-product-availability-modal";
import { BranchAccessoryInventoryModal } from "./branch-accessory-inventory-modal";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

const STORES_LIST = [];

export const BranchesPanel = memo(function BranchesPanel() {
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"branches" | "pincodes">("branches");
  const [showModal, setShowModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<any | null>(null);

  // Operational Modals
  const [activeProductModalBranch, setActiveProductModalBranch] = useState<any | null>(null);
  const [activeAccessoryModalBranch, setActiveAccessoryModalBranch] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [linkedStoreId, setLinkedStoreId] = useState("");
  const [branchType, setBranchType] = useState<string>("main_hub");
  const [extendedStatus, setExtendedStatus] = useState<string>("open");
  const [city, setCity] = useState("Bengaluru");
  const [state, setState] = useState("Karnataka");
  const [pincode, setPincode] = useState("560038");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [managerName, setManagerName] = useState("Rajesh Kumar");
  const [managerPhone, setManagerPhone] = useState("+91 98765 00001");
  const [managerEmail, setManagerEmail] = useState("manager@cakes2home.com");

  const [submitting, setSubmitting] = useState(false);

  const fetchBranches = () => {
    setLoading(true);
    setError(null);
    apiClient.getAdminBranches()
      .then((r: any) => setBranches(r?.branches || r?.data || []))
      .catch((err) => {
        console.error("[Branches Panel Error] Failed to fetch branches:", err);
        setError(err.message || "Failed to load branch operations");
        setBranches([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenCreate = () => {
    setEditingBranch(null);
    setName("");
    setCode(`HUB-BLR-${Math.floor(10 + Math.random() * 90)}`);
    setLinkedStoreId("");
    setBranchType("main_hub");
    setExtendedStatus("open");
    setCity("Bengaluru");
    setState("Karnataka");
    setPincode("560038");
    setAddress("");
    setPhone("+91 98765 00000");
    setEmail(`branch_${Date.now()}@cakes2home.com`);
    setManagerName("Branch Manager");
    setManagerPhone("+91 98765 00001");
    setManagerEmail("manager@cakes2home.com");

    setShowModal(true);
  };

  const handleOpenEdit = (b: any) => {
    setEditingBranch(b);
    setName(b.name || "");
    setCode(b.code || "");
    setLinkedStoreId(b.linked_store_id || "");
    setBranchType(b.branch_type || "main_hub");
    setExtendedStatus(b.extended_status || b.operational_status || "open");
    setCity(b.city || "Bengaluru");
    setState(b.state || "Karnataka");
    setPincode(b.pincode || "560038");
    setAddress(b.address || "");
    setPhone(b.phone || "");
    setEmail(b.email || "");
    setManagerName(b.manager_name || b.manager_account?.name || "");
    setManagerPhone(b.manager_account?.phone || b.phone || "");
    setManagerEmail(b.manager_account?.email || b.email || "");

    setShowModal(true);
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
    if (!name.trim()) return;
    setSubmitting(true);

    const payload = {
      id: editingBranch?.id,
      code,
      name,
      branch_type: branchType,
      extended_status: extendedStatus,
      operational_status: extendedStatus === "open" ? "operational" : extendedStatus === "busy" ? "busy" : "temporarily_closed",
      address,
      city,
      state,
      pincode,
      phone,
      email,
      manager_name: managerName,
      manager_account: {
        name: managerName,
        phone: managerPhone,
        email: managerEmail,
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
      } else {
        await apiClient.createAdminBranch(payload);
      }
      setShowModal(false);
      fetchBranches();
    } catch (err: any) {
      alert(`Failed to save branch: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBranch = async (id: string, branchName: string) => {
    if (!confirm(`Are you sure you want to delete branch "${branchName}"?`)) return;
    try {
      await apiClient.deleteAdminBranch(id);
      fetchBranches();
    } catch (err: any) {
      alert(err.message || "Failed to delete branch.");
    }
  };

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

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
            <span>⚠️ {error}</span>
            <Button size="small" variant="secondary" onClick={fetchBranches}>Retry Fetch</Button>
          </div>
        )}

        {tab === "pincodes" ? (
          <BranchPincodePanel />
        ) : (
          <Container className="p-6">
            <div className="flex items-center justify-between mb-4">
              <Text className="font-semibold text-base">Delivery Fulfillment Hubs ({branches.length})</Text>
            </div>

            {loading ? (
              <TableSkeleton rows={4} />
            ) : branches.length === 0 ? (
              <div className="text-center py-8 text-ui-fg-subtle">
                <Store className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-600" />
                <Text>No delivery fulfillment hubs configured.</Text>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {branches.map((b) => {
                  const currentLoad = b.capacity_settings?.current_load ?? b.current_hourly_load ?? 0;
                  const maxHourly = b.capacity_settings?.max_hourly_orders ?? b.max_orders_per_hour ?? 25;
                  const loadPct = Math.min(100, Math.round((currentLoad / maxHourly) * 100));
                  const isAutoPaused = b.capacity_settings?.is_auto_paused || loadPct >= 100;

                  const statusColor =
                    isAutoPaused || b.extended_status === "busy"
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
                    <div key={b.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900 space-y-4 hover:shadow-md transition">
                      {/* Top Row */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-slate-900 dark:text-white">{b.name}</span>
                            <Badge color="purple" className="text-[10px] font-extrabold">{b.code}</Badge>
                            <Badge color="blue" className="text-[10px]">{typeLabel}</Badge>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 mt-1">
                            <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                            <span>{b.address}, {b.city} ({b.pincode})</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <Badge color={statusColor} className="capitalize font-bold text-xs">
                            {isAutoPaused ? "AUTO-PAUSED (HIGH LOAD)" : b.extended_status || b.operational_status || "Open"}
                          </Badge>
                        </div>
                      </div>

                      {/* Branch Manager Fast Operational Controls */}
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

                      {/* Capacity Load Bar */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-slate-600 dark:text-slate-300">Live Order Load Capacity:</span>
                          <span className={`font-extrabold ${loadPct >= 90 ? "text-rose-600" : "text-emerald-600"}`}>
                            {currentLoad} / {maxHourly} orders/hr ({loadPct}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${loadPct >= 90 ? "bg-rose-500" : loadPct >= 70 ? "bg-amber-500" : "bg-emerald-500"}`}
                            style={{ width: `${loadPct}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <span>Scheduled Max: {b.capacity_settings?.max_scheduled_orders || 50}</span>
                          <span>Midnight Max: {b.capacity_settings?.max_midnight_orders || 15}</span>
                          <span>Express Max: {b.capacity_settings?.max_express_orders || 20}</span>
                        </div>
                      </div>

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
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="font-semibold">Delivery Provider:</span>
                          <span className="font-bold text-emerald-600 font-mono">CakeToHome Unified Fleet</span>
                        </div>
                      </div>

                      {/* Operational Actions Row */}
                      <div className="pt-3 border-t grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                        <Button size="small" variant="secondary" onClick={() => setActiveProductModalBranch(b)} className="text-[11px] font-bold">
                          <Cake className="w-3.5 h-3.5 mr-1 text-amber-600" /> Products
                        </Button>
                        <Button size="small" variant="secondary" onClick={() => setActiveAccessoryModalBranch(b)} className="text-[11px] font-bold">
                          <ShoppingBag className="w-3.5 h-3.5 mr-1 text-purple-600" /> Accessories
                        </Button>
                        <Button size="small" variant="transparent" onClick={() => handleOpenEdit(b)} className="text-[11px] font-bold text-blue-600">
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Hub
                        </Button>
                        <Button size="small" variant="transparent" onClick={() => handleDeleteBranch(b.id, b.name)} className="text-[11px] font-bold text-rose-600">
                          <Trash2 className="w-3.5 h-3.5 mr-1" /> Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Container>
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
                  <Label>City *</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} required />
                </div>
                <div>
                  <Label>Primary Pincode *</Label>
                  <Input value={pincode} onChange={(e) => setPincode(e.target.value)} required />
                </div>

                <div className="sm:col-span-2">
                  <Label>Full Street Address *</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="100 Feet Rd, Bengaluru" required />
                </div>

                <div>
                  <Label>Manager Phone</Label>
                  <Input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} />
                </div>
                <div>
                  <Label>Manager Email</Label>
                  <Input value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} />
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

