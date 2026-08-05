"use client";

import { useState, useEffect, useCallback } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  MapPin, Plus, Edit3, Trash2, Copy, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Search, Upload, Download, CheckCircle,
  AlertTriangle, Truck, Zap, Moon, Clock, Package, DollarSign,
  Settings2, ArrowRight, X, Layers,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliveryZone {
  id: string;
  name: string;
  display_order?: number;
  min_km: number;
  max_km: number;
  enabled: boolean;
  est_delivery_mins: number;
  preparation_buffer_mins: number;
  max_cake_weight_kg: number;
  max_cake_quantity?: number;
  min_order_value: number;
  max_order_value?: number;
  free_delivery_threshold: number;
  same_day_allowed: boolean;
  express_allowed: boolean;
  midnight_allowed: boolean;
  scheduled_allowed: boolean;
  delivery_charge: number;
  express_charge: number;
  midnight_charge: number;
  holiday_charge?: number;
  cities?: string[];
  areas?: string[];
  service_areas?: string[];
  pincodes?: string[];
}

const EMPTY_ZONE: Omit<DeliveryZone, "id"> = {
  name: "",
  display_order: 1,
  min_km: 0,
  max_km: 5,
  enabled: true,
  est_delivery_mins: 45,
  preparation_buffer_mins: 15,
  max_cake_weight_kg: 10,
  max_cake_quantity: 5,
  min_order_value: 299,
  max_order_value: 50000,
  free_delivery_threshold: 999,
  same_day_allowed: true,
  express_allowed: true,
  midnight_allowed: false,
  scheduled_allowed: true,
  delivery_charge: 0,
  express_charge: 99,
  midnight_charge: 79,
  holiday_charge: 49,
  cities: [],
  areas: [],
  service_areas: [],
  pincodes: [],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function zoneBadgeColor(z: DeliveryZone): "green" | "grey" | "orange" {
  if (!z.enabled) return "grey";
  if (z.pincodes && z.pincodes.length === 0) return "orange";
  return "green";
}

function ZoneToggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-8 h-4.5 rounded-full flex items-center transition-colors px-0.5 ${checked ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
      style={{ minWidth: 32, height: 18, padding: "0 2px" }}
    >
      <span
        className={`inline-block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-3.5" : "translate-x-0"}`}
        style={{ width: 14, height: 14, minWidth: 14, transition: "transform 0.15s" }}
      />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BranchZoneManager() {
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [zones, setZones] = useState<DeliveryZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);

  // Zone modal
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [editingZone, setEditingZone] = useState<DeliveryZone | null>(null);
  const [zoneForm, setZoneForm] = useState<Omit<DeliveryZone, "id">>(EMPTY_ZONE);

  // Pincode management
  const [showPincodeModal, setShowPincodeModal] = useState(false);
  const [pincodeZone, setPincodeZone] = useState<DeliveryZone | null>(null);
  const [newPincode, setNewPincode] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newArea, setNewArea] = useState("");
  const [newServiceArea, setNewServiceArea] = useState("");
  const [bulkPincodesText, setBulkPincodesText] = useState("");
  const [pincodeSearchTerm, setPincodeSearchTerm] = useState("");
  const [pincodeTab, setPincodeTab] = useState<"pincodes" | "areas">("pincodes");

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ── Data Fetching ─────────────────────────────────────────────────────────

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminBranches();
      const list = res?.branches || res?.data || [];
      setBranches(list);
      if (!selectedBranchId && list.length > 0) {
        setSelectedBranchId(list[0].id);
      }
    } catch {
      showToast("Failed to load branches", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => { fetchBranches(); }, []);

  useEffect(() => {
    const branch = branches.find((b) => b.id === selectedBranchId);
    if (branch) {
      const sorted = [...(branch.delivery_zones || [])].sort(
        (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)
      );
      setZones(sorted);
      setActiveZoneId(sorted.length > 0 ? sorted[0].id : null);
    } else {
      setZones([]);
      setActiveZoneId(null);
    }
  }, [selectedBranchId, branches]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3200);
  }

  async function persistZones(updatedZones: DeliveryZone[]) {
    setSaving(true);
    try {
      await apiClient.updateAdminBranch(selectedBranchId, { delivery_zones: updatedZones });
      await fetchBranches();
      showToast("Saved successfully");
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  }

  // ── Zone CRUD ──────────────────────────────────────────────────────────────

  function openCreateZone() {
    setEditingZone(null);
    setZoneForm({ ...EMPTY_ZONE, name: `Zone ${zones.length + 1}`, display_order: zones.length + 1 });
    setShowZoneModal(true);
  }

  function openEditZone(zone: DeliveryZone) {
    setEditingZone(zone);
    const { id: _id, ...rest } = zone;
    setZoneForm(rest);
    setShowZoneModal(true);
  }

  async function handleSaveZone(e: React.FormEvent) {
    e.preventDefault();
    if (!zoneForm.name.trim()) { showToast("Zone name is required", "error"); return; }
    let updatedZones: DeliveryZone[];
    if (editingZone) {
      updatedZones = zones.map((z) =>
        z.id === editingZone.id ? { ...editingZone, ...zoneForm } : z
      );
    } else {
      const newZone: DeliveryZone = {
        id: `zone_${selectedBranchId}_${Date.now()}`,
        ...zoneForm,
        pincodes: zoneForm.pincodes ?? [],
        cities: zoneForm.cities ?? [],
        areas: zoneForm.areas ?? [],
        service_areas: zoneForm.service_areas ?? [],
      };
      updatedZones = [...zones, newZone];
    }
    // Re-order display_order based on position
    updatedZones = updatedZones.map((z, i) => ({ ...z, display_order: i + 1 }));
    setShowZoneModal(false);
    await persistZones(updatedZones);
  }

  async function duplicateZone(zone: DeliveryZone) {
    const dup: DeliveryZone = {
      ...zone,
      id: `zone_${selectedBranchId}_dup_${Date.now()}`,
      name: `${zone.name} (Copy)`,
      display_order: zones.length + 1,
      pincodes: [], // Reset pincodes — admin must reassign
    };
    const updated = [...zones, dup].map((z, i) => ({ ...z, display_order: i + 1 }));
    await persistZones(updated);
  }

  async function deleteZone(zoneId: string) {
    if (!confirm("Delete this zone? This will unassign all its pincodes.")) return;
    const updated = zones.filter((z) => z.id !== zoneId).map((z, i) => ({ ...z, display_order: i + 1 }));
    await persistZones(updated);
    setActiveZoneId(updated.length > 0 ? updated[0].id : null);
  }

  async function toggleZoneEnabled(zone: DeliveryZone) {
    const updated = zones.map((z) => z.id === zone.id ? { ...z, enabled: !z.enabled } : z);
    await persistZones(updated);
  }

  async function moveZoneUp(idx: number) {
    if (idx === 0) return;
    const arr = [...zones];
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
    await persistZones(arr.map((z, i) => ({ ...z, display_order: i + 1 })));
  }

  async function moveZoneDown(idx: number) {
    if (idx >= zones.length - 1) return;
    const arr = [...zones];
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
    await persistZones(arr.map((z, i) => ({ ...z, display_order: i + 1 })));
  }

  // ── Pincode Management ─────────────────────────────────────────────────────

  function openPincodeManager(zone: DeliveryZone) {
    setPincodeZone(zone);
    setNewPincode("");
    setNewCity(zone.cities?.[0] ?? "");
    setNewArea("");
    setNewServiceArea("");
    setBulkPincodesText("");
    setPincodeSearchTerm("");
    setPincodeTab("pincodes");
    setShowPincodeModal(true);
  }

  async function addPincode() {
    if (!newPincode.trim() || !pincodeZone) return;
    const pin = newPincode.trim();
    if ((pincodeZone.pincodes || []).includes(pin)) {
      showToast(`Pincode ${pin} already in this zone`, "error");
      return;
    }
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, pincodes: [...(z.pincodes ?? []), pin] }
        : z
    );
    setPincodeZone({ ...pincodeZone, pincodes: [...(pincodeZone.pincodes ?? []), pin] });
    setNewPincode("");
    await persistZones(updated);
  }

  async function removePincode(pin: string) {
    if (!pincodeZone) return;
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, pincodes: (z.pincodes ?? []).filter((p) => p !== pin) }
        : z
    );
    setPincodeZone({ ...pincodeZone, pincodes: (pincodeZone.pincodes ?? []).filter((p) => p !== pin) });
    await persistZones(updated);
  }

  async function bulkImportPincodes() {
    if (!pincodeZone || !bulkPincodesText.trim()) return;
    const incoming = bulkPincodesText
      .split(/[\n,]/)
      .map((p) => p.trim())
      .filter((p) => /^\d{6}$/.test(p));
    const existing = new Set(pincodeZone.pincodes ?? []);
    const newOnes = incoming.filter((p) => !existing.has(p));
    const merged = [...Array.from(existing), ...newOnes];
    const updated = zones.map((z) =>
      z.id === pincodeZone.id ? { ...z, pincodes: merged } : z
    );
    setPincodeZone({ ...pincodeZone, pincodes: merged });
    setBulkPincodesText("");
    showToast(`Added ${newOnes.length} pincodes`);
    await persistZones(updated);
  }

  async function addArea() {
    if (!pincodeZone || !newArea.trim()) return;
    const area = newArea.trim();
    if ((pincodeZone.areas ?? []).includes(area)) { showToast("Area already in zone", "error"); return; }
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, areas: [...(z.areas ?? []), area] }
        : z
    );
    setPincodeZone({ ...pincodeZone, areas: [...(pincodeZone.areas ?? []), area] });
    setNewArea("");
    await persistZones(updated);
  }

  async function removeArea(area: string) {
    if (!pincodeZone) return;
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, areas: (z.areas ?? []).filter((a) => a !== area) }
        : z
    );
    setPincodeZone({ ...pincodeZone, areas: (pincodeZone.areas ?? []).filter((a) => a !== area) });
    await persistZones(updated);
  }

  async function addCity() {
    if (!pincodeZone || !newCity.trim()) return;
    const city = newCity.trim();
    if ((pincodeZone.cities ?? []).includes(city)) { showToast("City already in zone", "error"); return; }
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, cities: [...(z.cities ?? []), city] }
        : z
    );
    setPincodeZone({ ...pincodeZone, cities: [...(pincodeZone.cities ?? []), city] });
    setNewCity("");
    await persistZones(updated);
  }

  async function addServiceArea() {
    if (!pincodeZone || !newServiceArea.trim()) return;
    const sa = newServiceArea.trim();
    if ((pincodeZone.service_areas ?? []).includes(sa)) { showToast("Service area already in zone", "error"); return; }
    const updated = zones.map((z) =>
      z.id === pincodeZone.id
        ? { ...z, service_areas: [...(z.service_areas ?? []), sa] }
        : z
    );
    setPincodeZone({ ...pincodeZone, service_areas: [...(pincodeZone.service_areas ?? []), sa] });
    setNewServiceArea("");
    await persistZones(updated);
  }

  function exportPincodesCSV() {
    const rows = ["Zone Name,Min KM,Max KM,Delivery Charge,Express Charge,City,Area,Service Area,Pincode"];
    zones.forEach((z) => {
      (z.pincodes ?? []).forEach((pin) => {
        rows.push(`"${z.name}",${z.min_km},${z.max_km},${z.delivery_charge},${z.express_charge},"${(z.cities ?? []).join(";")}","${(z.areas ?? []).join(";")}","${(z.service_areas ?? []).join(";")}",${pin}`);
      });
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zones_${selectedBranchId}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Form Helper ──────────────────────────────────────────────────────────

  function zf<K extends keyof typeof EMPTY_ZONE>(key: K, value: (typeof EMPTY_ZONE)[K]) {
    setZoneForm((f) => ({ ...f, [key]: value }));
  }

  const selectedBranch = branches.find((b) => b.id === selectedBranchId);
  const activeZone = zones.find((z) => z.id === activeZoneId);
  const filteredPincodes = (pincodeZone?.pincodes ?? []).filter((p) =>
    p.includes(pincodeSearchTerm.trim())
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-[200] px-4 py-2.5 rounded-lg shadow-xl text-sm font-semibold flex items-center gap-2 transition-all ${toast.type === "success" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Heading level="h3" className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-600" />
            Branch Delivery Zone Manager
          </Heading>
          <Text className="text-[11px] text-slate-500 mt-0.5">
            Each branch has completely independent delivery zones. Zones own all pricing, service areas, and pincodes.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              const srcId = prompt("Enter Source Branch ID to copy zones from:");
              if (srcId) {
                const ok = (apiClient as any).copyBranchZones?.(srcId, selectedBranchId);
                if (ok) { fetchBranches(); showToast("Zones copied!"); } else { showToast("Failed to copy zones", "error"); }
              }
            }}
            className="text-[11px] gap-1"
          >
            <Copy className="w-3.5 h-3.5" /> Copy Zones
          </Button>
          <Button size="small" variant="secondary" onClick={exportPincodesCSV} className="text-[11px] gap-1">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Branch Selector */}
      <div>
        <Label className="text-[11px] text-slate-500 mb-1 block">Select Delivery Hub Branch</Label>
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-400 focus:border-transparent outline-none"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} — {b.name} ({b.city || "—"}) · {(b.delivery_zones || []).length} Zone{(b.delivery_zones || []).length !== 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-xs">Loading zones…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Zone List Sidebar */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <Text className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Zones ({zones.length})
              </Text>
              <Button size="small" variant="secondary" onClick={openCreateZone} className="text-[10px] gap-1">
                <Plus className="w-3 h-3" /> Add Zone
              </Button>
            </div>

            {zones.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-6 text-center">
                <Truck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <Text className="text-xs text-slate-400 font-medium">No delivery zones configured</Text>
                <Text className="text-[10px] text-slate-400 mt-1">Add zones to enable delivery for this branch</Text>
                <Button size="small" variant="secondary" onClick={openCreateZone} className="mt-3 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Create First Zone
                </Button>
              </div>
            ) : (
              zones.map((zone, idx) => (
                <div
                  key={zone.id}
                  onClick={() => setActiveZoneId(zone.id)}
                  className={`rounded-xl border cursor-pointer transition-all p-3 group relative ${
                    activeZoneId === zone.id
                      ? "border-amber-400 bg-amber-50/60 dark:bg-amber-950/30 shadow-md"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-300"
                  }`}
                >
                  {/* Zone Header Row */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <Badge color={zoneBadgeColor(zone)} className="text-[9px] px-1 font-bold">
                        {zone.enabled ? "ON" : "OFF"}
                      </Badge>
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{zone.name}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button title="Move up" onClick={(e) => { e.stopPropagation(); moveZoneUp(idx); }} disabled={idx === 0} className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                        <ChevronUp className="w-3 h-3 text-slate-500" />
                      </button>
                      <button title="Move down" onClick={(e) => { e.stopPropagation(); moveZoneDown(idx); }} disabled={idx >= zones.length - 1} className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                        <ChevronDown className="w-3 h-3 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  {/* Zone Meta */}
                  <div className="flex gap-3 text-[10px] text-slate-500">
                    <span><MapPin className="w-2.5 h-2.5 inline mr-0.5" />{zone.min_km}–{zone.max_km} km</span>
                    <span><Clock className="w-2.5 h-2.5 inline mr-0.5" />{zone.est_delivery_mins} min</span>
                    <span><Package className="w-2.5 h-2.5 inline mr-0.5" />{(zone.pincodes ?? []).length} pincodes</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    <DollarSign className="w-2.5 h-2.5 inline mr-0.5 text-emerald-600" />
                    ₹{zone.delivery_charge} delivery · ₹{zone.express_charge} express · ₹{zone.midnight_charge} midnight
                  </div>

                  {/* Warn if no pincodes */}
                  {(zone.pincodes ?? []).length === 0 && zone.enabled && (
                    <div className="mt-1.5 text-[9px] text-orange-500 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> No pincodes assigned — not serving any area
                    </div>
                  )}

                  {/* Delivery Mode Badges */}
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {zone.same_day_allowed && <span className="text-[9px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded font-bold">SameDay</span>}
                    {zone.express_allowed && <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded font-bold"><Zap className="w-2 h-2 inline" />Express</span>}
                    {zone.midnight_allowed && <span className="text-[9px] bg-indigo-100 text-indigo-700 px-1 py-0.5 rounded font-bold"><Moon className="w-2 h-2 inline" />Midnight</span>}
                    {zone.scheduled_allowed && <span className="text-[9px] bg-slate-100 text-slate-600 px-1 py-0.5 rounded font-bold">Scheduled</span>}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Zone Detail Panel */}
          <div className="lg:col-span-3">
            {!activeZone ? (
              <div className="h-full flex items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                <div>
                  <Settings2 className="w-10 h-10 mx-auto text-slate-300 mb-3" />
                  <Text className="text-sm text-slate-400 font-medium">Select a zone to view details</Text>
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
                {/* Zone Header */}
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-amber-900/20 border-b border-amber-200/50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">{activeZone.name}</Heading>
                      <Badge color={zoneBadgeColor(activeZone)} className="text-[9px]">{activeZone.enabled ? "Active" : "Disabled"}</Badge>
                    </div>
                    <Text className="text-[10px] text-slate-500">{activeZone.min_km}–{activeZone.max_km} km · {activeZone.est_delivery_mins} min ETA · {(activeZone.pincodes ?? []).length} pincodes</Text>
                  </div>
                  {/* Zone Actions */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => toggleZoneEnabled(activeZone)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${activeZone.enabled ? "bg-rose-100 text-rose-600 hover:bg-rose-200" : "bg-emerald-100 text-emerald-600 hover:bg-emerald-200"}`}
                    >
                      {activeZone.enabled ? <ToggleRight className="w-3 h-3" /> : <ToggleLeft className="w-3 h-3" />}
                      {activeZone.enabled ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => openEditZone(activeZone)} className="px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => duplicateZone(activeZone)} className="px-2 py-1 bg-slate-50 text-slate-600 hover:bg-slate-100 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <Copy className="w-3 h-3" /> Duplicate
                    </button>
                    <button onClick={() => openPincodeManager(activeZone)} className="px-2 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Manage Areas
                    </button>
                    <button onClick={() => deleteZone(activeZone.id)} className="px-2 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-[10px] font-bold flex items-center gap-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Zone Details Grid */}
                <div className="p-4 grid grid-cols-2 gap-4 text-xs">
                  {/* Pricing */}
                  <div className="space-y-2">
                    <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500">Pricing</Text>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500">Delivery Fee</div>
                        <div className="font-bold text-emerald-700 text-sm">₹{activeZone.delivery_charge}</div>
                      </div>
                      <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500">Express Fee</div>
                        <div className="font-bold text-amber-700 text-sm">₹{activeZone.express_charge}</div>
                      </div>
                      <div className="bg-indigo-50 dark:bg-indigo-950/30 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500">Midnight Fee</div>
                        <div className="font-bold text-indigo-700 text-sm">₹{activeZone.midnight_charge}</div>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500">Free Delivery ≥</div>
                        <div className="font-bold text-slate-700 dark:text-slate-300 text-sm">₹{activeZone.free_delivery_threshold}</div>
                      </div>
                    </div>
                  </div>

                  {/* Rules */}
                  <div className="space-y-2">
                    <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500">Delivery Rules</Text>
                    <div className="space-y-1.5">
                      {[
                        { label: "Same Day", val: activeZone.same_day_allowed },
                        { label: "Express", val: activeZone.express_allowed },
                        { label: "Midnight", val: activeZone.midnight_allowed },
                        { label: "Scheduled", val: activeZone.scheduled_allowed },
                      ].map(({ label, val }) => (
                        <div key={label} className="flex items-center justify-between font-mono">
                          <span className="text-[11px] text-slate-600 dark:text-slate-400">{label}</span>
                          <Badge color={val ? "green" : "grey"} className="text-[9px] px-1">{val ? "✓ Allowed" : "✗ Blocked"}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Coverage */}
                  <div className="col-span-2 space-y-2">
                    <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500">Coverage — Cities / Areas / Service Areas</Text>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Cities</div>
                        <div className="flex flex-wrap gap-1">
                          {(activeZone.cities ?? []).length === 0
                            ? <span className="text-[10px] text-slate-300 italic">None set</span>
                            : (activeZone.cities ?? []).map((c) => <Badge key={c} color="blue" className="text-[9px]">{c}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Areas</div>
                        <div className="flex flex-wrap gap-1">
                          {(activeZone.areas ?? []).length === 0
                            ? <span className="text-[10px] text-slate-300 italic">None set</span>
                            : (activeZone.areas ?? []).map((a) => <Badge key={a} color="green" className="text-[9px]">{a}</Badge>)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400 mb-1">Service Areas</div>
                        <div className="flex flex-wrap gap-1">
                          {(activeZone.service_areas ?? []).length === 0
                            ? <span className="text-[10px] text-slate-300 italic">None set</span>
                            : (activeZone.service_areas ?? []).map((s) => <Badge key={s} color="orange" className="text-[9px]">{s}</Badge>)}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Pincodes Preview */}
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500">
                        Pincodes ({(activeZone.pincodes ?? []).length})
                      </Text>
                      <button onClick={() => openPincodeManager(activeZone)} className="text-[10px] text-amber-600 font-semibold hover:underline flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Manage Pincodes <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {(activeZone.pincodes ?? []).length === 0 ? (
                      <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 rounded-lg p-3 text-[10px] text-orange-600 font-medium flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> No pincodes assigned to this zone. Customers cannot be served until pincodes are added.
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {(activeZone.pincodes ?? []).slice(0, 30).map((p) => (
                          <span key={p} className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono px-1.5 py-0.5 rounded">{p}</span>
                        ))}
                        {(activeZone.pincodes ?? []).length > 30 && (
                          <span className="text-[10px] text-slate-400">+{(activeZone.pincodes ?? []).length - 30} more</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Zone Create/Edit Modal ──────────────────────────────────────────── */}
      {showZoneModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between">
              <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">
                {editingZone ? `Edit Zone: ${editingZone.name}` : "Create New Delivery Zone"}
              </Heading>
              <button onClick={() => setShowZoneModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="p-5 space-y-5">
              {/* Basic Info */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Basic Info</Text>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs">Zone Name *</Label>
                    <Input value={zoneForm.name} onChange={(e) => zf("name", e.target.value)} placeholder="e.g. Zone 1 (Nearby)" required />
                  </div>
                  <div>
                    <Label className="text-xs">Min Distance (KM)</Label>
                    <Input type="number" min={0} step={0.5} value={zoneForm.min_km} onChange={(e) => zf("min_km", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Distance (KM)</Label>
                    <Input type="number" min={0} step={0.5} value={zoneForm.max_km} onChange={(e) => zf("max_km", parseFloat(e.target.value) || 5)} />
                  </div>
                  <div>
                    <Label className="text-xs">Est. Delivery Time (mins)</Label>
                    <Input type="number" min={1} value={zoneForm.est_delivery_mins} onChange={(e) => zf("est_delivery_mins", parseInt(e.target.value) || 45)} />
                  </div>
                  <div>
                    <Label className="text-xs">Prep Buffer (mins)</Label>
                    <Input type="number" min={0} value={zoneForm.preparation_buffer_mins} onChange={(e) => zf("preparation_buffer_mins", parseInt(e.target.value) || 15)} />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Pricing</Text>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Delivery Fee (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.delivery_charge} onChange={(e) => zf("delivery_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Express Add-on (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.express_charge} onChange={(e) => zf("express_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Midnight Add-on (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.midnight_charge} onChange={(e) => zf("midnight_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Holiday Add-on (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.holiday_charge ?? 0} onChange={(e) => zf("holiday_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Free Delivery Threshold (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.free_delivery_threshold} onChange={(e) => zf("free_delivery_threshold", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Min Order Value (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.min_order_value} onChange={(e) => zf("min_order_value", parseFloat(e.target.value) || 0)} />
                  </div>
                </div>
              </div>

              {/* Delivery Modes */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Delivery Modes</Text>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { key: "same_day_allowed" as const, label: "Same Day Delivery" },
                    { key: "express_allowed" as const, label: "Express (45 min)" },
                    { key: "midnight_allowed" as const, label: "Midnight Delivery" },
                    { key: "scheduled_allowed" as const, label: "Scheduled Delivery" },
                  ] as const).map(({ key, label }) => (
                    <label key={key} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-3 py-2 cursor-pointer">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                      <ZoneToggle checked={zoneForm[key] as boolean} onChange={(v) => zf(key, v)} />
                    </label>
                  ))}
                </div>
              </div>

              {/* Limits */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Order Limits</Text>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Max Cake Weight (kg)</Label>
                    <Input type="number" min={0} step={0.5} value={zoneForm.max_cake_weight_kg} onChange={(e) => zf("max_cake_weight_kg", parseFloat(e.target.value) || 10)} />
                  </div>
                  <div>
                    <Label className="text-xs">Max Cake Quantity</Label>
                    <Input type="number" min={1} value={zoneForm.max_cake_quantity ?? 5} onChange={(e) => zf("max_cake_quantity", parseInt(e.target.value) || 5)} />
                  </div>
                </div>
              </div>

              {/* Enabled */}
              <label className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/20 rounded-xl px-4 py-3 cursor-pointer">
                <div>
                  <span className="text-sm font-semibold text-slate-800 dark:text-white">Zone Enabled</span>
                  <div className="text-[10px] text-slate-500">Disabled zones do not accept orders</div>
                </div>
                <ZoneToggle checked={zoneForm.enabled} onChange={(v) => zf("enabled", v)} />
              </label>

              {/* Note about pincodes */}
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200/50 rounded-lg p-3 text-[10px] text-blue-600">
                <strong>Note:</strong> Cities, Areas, Service Areas, and Pincodes are managed from the "Manage Areas" button after creating the zone.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" size="small" onClick={() => setShowZoneModal(false)}>Cancel</Button>
                <Button type="submit" size="small" isLoading={saving}>
                  {editingZone ? "Save Changes" : "Create Zone"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Pincode / Area Manager Modal ────────────────────────────────────── */}
      {showPincodeModal && pincodeZone && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between shrink-0">
              <div>
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">
                  Manage: {pincodeZone.name}
                </Heading>
                <Text className="text-[10px] text-slate-500">
                  {selectedBranch?.name} · {pincodeZone.min_km}–{pincodeZone.max_km} km
                </Text>
              </div>
              <button onClick={() => setShowPincodeModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
              {(["pincodes", "areas"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setPincodeTab(t)}
                  className={`px-5 py-2.5 text-xs font-semibold transition-colors capitalize ${pincodeTab === t ? "border-b-2 border-amber-500 text-amber-600" : "text-slate-500 hover:text-slate-800"}`}
                >
                  {t === "pincodes" ? `Pincodes (${filteredPincodes.length})` : "Cities & Areas"}
                </button>
              ))}
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {pincodeTab === "pincodes" ? (
                <>
                  {/* Add Single Pincode */}
                  <div>
                    <Label className="text-xs mb-1">Add Pincode</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newPincode}
                        onChange={(e) => setNewPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="e.g. 560034"
                        maxLength={6}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPincode(); } }}
                        className="font-mono"
                      />
                      <Button size="small" onClick={addPincode} disabled={newPincode.length !== 6 || saving}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {/* Bulk Import */}
                  <div>
                    <Label className="text-xs mb-1">Bulk Import (comma or newline separated)</Label>
                    <textarea
                      value={bulkPincodesText}
                      onChange={(e) => setBulkPincodesText(e.target.value)}
                      placeholder="560034, 560095, 560068&#10;560047&#10;560076"
                      rows={3}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-400 outline-none resize-y"
                    />
                    <Button size="small" variant="secondary" onClick={bulkImportPincodes} className="mt-1.5" disabled={!bulkPincodesText.trim() || saving}>
                      <Upload className="w-3 h-3 mr-1" /> Bulk Import
                    </Button>
                  </div>

                  {/* Search + List */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={pincodeSearchTerm}
                          onChange={(e) => setPincodeSearchTerm(e.target.value)}
                          placeholder="Search pincodes..."
                          className="w-full border border-slate-200 dark:border-slate-600 rounded-lg pl-7 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 outline-none"
                        />
                      </div>
                      <Text className="text-[10px] text-slate-400">{filteredPincodes.length} pincodes</Text>
                    </div>
                    {filteredPincodes.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 text-xs">No pincodes assigned yet</div>
                    ) : (
                      <div className="grid grid-cols-3 gap-1.5 max-h-60 overflow-y-auto">
                        {filteredPincodes.map((p) => (
                          <div key={p} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1.5 group">
                            <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{p}</span>
                            <button
                              onClick={() => removePincode(p)}
                              className="opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity ml-1"
                              title="Remove"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Areas Tab */
                <div className="space-y-4">
                  {/* Cities */}
                  <div>
                    <Label className="text-xs mb-1">Cities</Label>
                    <div className="flex gap-2 mb-2">
                      <Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="e.g. Bengaluru" />
                      <Button size="small" onClick={addCity} disabled={!newCity.trim() || saving}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(pincodeZone.cities ?? []).map((c) => (
                        <span key={c} className="flex items-center gap-1 bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                          {c}
                          <button onClick={async () => {
                            const updated = zones.map((z) => z.id === pincodeZone.id ? { ...z, cities: (z.cities ?? []).filter((x) => x !== c) } : z);
                            setPincodeZone({ ...pincodeZone, cities: (pincodeZone.cities ?? []).filter((x) => x !== c) });
                            await persistZones(updated);
                          }}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Areas */}
                  <div>
                    <Label className="text-xs mb-1">Areas / Localities</Label>
                    <div className="flex gap-2 mb-2">
                      <Input value={newArea} onChange={(e) => setNewArea(e.target.value)} placeholder="e.g. Koramangala" />
                      <Button size="small" onClick={addArea} disabled={!newArea.trim() || saving}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(pincodeZone.areas ?? []).map((a) => (
                        <span key={a} className="flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                          {a}
                          <button onClick={() => removeArea(a)}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Service Areas */}
                  <div>
                    <Label className="text-xs mb-1">Service Areas (sub-locality groups)</Label>
                    <div className="flex gap-2 mb-2">
                      <Input value={newServiceArea} onChange={(e) => setNewServiceArea(e.target.value)} placeholder="e.g. HSR Sector 1 Hub" />
                      <Button size="small" onClick={addServiceArea} disabled={!newServiceArea.trim() || saving}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(pincodeZone.service_areas ?? []).map((s) => (
                        <span key={s} className="flex items-center gap-1 bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-1 rounded-full">
                          {s}
                          <button onClick={async () => {
                            const updated = zones.map((z) => z.id === pincodeZone.id ? { ...z, service_areas: (z.service_areas ?? []).filter((x) => x !== s) } : z);
                            setPincodeZone({ ...pincodeZone, service_areas: (pincodeZone.service_areas ?? []).filter((x) => x !== s) });
                            await persistZones(updated);
                          }}><X className="w-2.5 h-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex items-center justify-between shrink-0">
              <Text className="text-[10px] text-slate-400">
                <MapPin className="w-3 h-3 inline mr-0.5" />
                Flow: {selectedBranch?.name} → {pincodeZone.name} → City → Area → Service Area → Pincode
              </Text>
              <Button size="small" variant="secondary" onClick={() => setShowPincodeModal(false)}>Done</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
