"use client";

import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  MapPin, Plus, Edit3, Trash2, Copy, ChevronUp, ChevronDown,
  ToggleLeft, ToggleRight, Search, Upload, Download, CheckCircle,
  AlertTriangle, Truck, Zap, Moon, Clock, Package, DollarSign,
  Settings2, ArrowRight, X, Layers, Map, Shield, Pentagon,
} from "lucide-react";
import dynamic from "next/dynamic";

const MapFenceEditor = dynamic(
  () => import("./map-fence-editor").then((m) => m.MapFenceEditor),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-xs text-ui-fg-muted animate-pulse">
        Loading geofence map editor...
      </div>
    ),
  }
);

// ─── Types ──────────────────────────────────────────────────────────────────

interface DeliveryPricingBracketLocal {
  min_km: number;
  max_km: number;
  charge: number;
  label?: string;
  enabled?: boolean;
}

interface DeliveryZone {
  id: string;
  name: string;
  display_order?: number;
  priority?: number;
  fence_type?: "polygon" | "radius" | "hybrid";
  boundary_type?: "polygon" | "radius" | "hybrid";
  radius_km?: number;
  max_serviceable_km?: number;
  remaining_radius_km?: number;
  polygon_coordinates?: Array<{ lat: number; lng: number }>;
  exclusion_polygons?: Array<Array<{ lat: number; lng: number }>>;
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
  instant_allowed?: boolean;
  midnight_allowed: boolean;
  scheduled_allowed: boolean;
  pricing_type?: "flat" | "distance_bracket";
  pricing_brackets?: DeliveryPricingBracketLocal[];
  delivery_charge: number;
  express_charge: number;
  instant_charge?: number;
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
  priority: 10,
  fence_type: "hybrid",
  boundary_type: "hybrid",
  radius_km: 5,
  max_serviceable_km: 10,
  polygon_coordinates: [],
  exclusion_polygons: [],
  min_km: 0,
  max_km: 5,
  enabled: true,
  est_delivery_mins: 45,
  preparation_buffer_mins: 15,
  max_cake_weight_kg: 10,
  max_cake_quantity: 5,
  min_order_value: 299,
  max_order_value: 50000,
  free_delivery_threshold: 0,
  same_day_allowed: true,
  express_allowed: true,
  instant_allowed: false,
  midnight_allowed: false,
  scheduled_allowed: true,
  pricing_type: "flat",
  pricing_brackets: [],
  delivery_charge: 0,
  express_charge: 99,
  instant_charge: 149,
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
  const hasMap = (z.polygon_coordinates && (z.polygon_coordinates as any[]).length >= 3) || ((z.radius_km ?? z.max_km ?? 0) > 0);
  if (!hasMap && (!z.pincodes || z.pincodes.length === 0)) return "orange";
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
  const [showMapFence, setShowMapFence] = useState(true);

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
    } catch (err: any) {
      showToast(err?.message || "Failed to save", "error");
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

    const storeMax = selectedBranch?.max_delivery_radius_km ?? 15;
    const effectiveMax = Math.min(25, storeMax, zoneForm.max_serviceable_km || storeMax);

    // Validate radius if radius or hybrid mode
    const isRadius = zoneForm.fence_type === "radius" || zoneForm.fence_type === "hybrid" || zoneForm.boundary_type === "radius" || zoneForm.boundary_type === "hybrid";
    const rawRadius = zoneForm.radius_km ?? zoneForm.max_km;
    if (isRadius && rawRadius !== undefined) {
      if (rawRadius > effectiveMax) {
        showToast(`Radius (${rawRadius} km) exceeds maximum allowed service boundary (${effectiveMax} km).`, "error");
        return;
      }
    }

    // Validate pricing brackets
    if (zoneForm.pricing_type === "distance_bracket" && Array.isArray(zoneForm.pricing_brackets)) {
      for (const b of zoneForm.pricing_brackets) {
        if (b.max_km > effectiveMax) {
          showToast(`Pricing bracket ${b.min_km}–${b.max_km} km exceeds maximum delivery radius (${effectiveMax} km).`, "error");
          return;
        }
      }
    }

    let updatedZones: DeliveryZone[];
    const normalizedZone = {
      ...zoneForm,
      max_serviceable_km: effectiveMax,
      remaining_radius_km: Number(Math.max(0, effectiveMax - (rawRadius ?? 0)).toFixed(2)),
    };

    if (editingZone) {
      updatedZones = zones.map((z) =>
        z.id === editingZone.id ? { ...editingZone, ...normalizedZone } : z
      );
    } else {
      const newZone: DeliveryZone = {
        id: `zone_${selectedBranchId}_${Date.now()}`,
        ...normalizedZone,
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
            <Layers className="w-4 h-4 text-brand-gold" />
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
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-semibold bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} — {b.name} ({b.city || "—"}) · {(b.delivery_zones || []).length} Zone{(b.delivery_zones || []).length !== 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Store Identity & Radius Matrix Header */}
      {selectedBranch && (
        <div className="p-4 bg-gradient-to-r from-brand-gold-light/80 to-brand-gold-light/60 dark:from-slate-800 dark:to-slate-800/80 rounded-2xl border border-brand-gold/40 dark:border-slate-700 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-gold/60 dark:border-slate-700 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white flex items-center gap-1.5">
                  🏪 {selectedBranch.name}
                </span>
                <span className="font-mono text-[10px] bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold px-2 py-0.5 rounded font-bold">
                  {selectedBranch.code}
                </span>
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span><strong>State:</strong> {selectedBranch.state || "Kerala"}</span>
                <span>•</span>
                <span><strong>City:</strong> {selectedBranch.city || "Kollam"}</span>
                <span>•</span>
                <span className="font-mono text-[11px] text-slate-500">
                  📍 {typeof selectedBranch.latitude === "number" ? selectedBranch.latitude.toFixed(4) : "12.9716"}° N, {typeof selectedBranch.longitude === "number" ? selectedBranch.longitude.toFixed(4) : "77.5946"}° E
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button size="small" onClick={openCreateZone} className="bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-xs gap-1.5 shadow-sm">
                <Plus className="w-3.5 h-3.5" /> + Add Delivery Area
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-brand-gold/10 rounded-lg text-brand-gold dark:text-brand-gold">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>Store Maximum Service Radius:</span>
                  <span className="text-brand-gold-dark dark:text-brand-gold font-extrabold">{selectedBranch.max_delivery_radius_km ?? 15} km</span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Global Ceiling: 25 km · All delivery areas for {selectedBranch.name} are capped by this store-level boundary.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Set Limit:</Label>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={1}
                  max={25}
                  step={0.5}
                  className="w-20 text-xs h-8"
                  defaultValue={selectedBranch.max_delivery_radius_km ?? 15}
                  key={selectedBranch.id + "_" + (selectedBranch.max_delivery_radius_km ?? 15)}
                  onBlur={async (e) => {
                    const val = parseFloat(e.target.value);
                    if (isNaN(val) || val <= 0 || val > 25) {
                      showToast("Store radius must be between 1 and 25 km", "error");
                      return;
                    }
                    if (val === selectedBranch.max_delivery_radius_km) return;
                    try {
                      await apiClient.updateAdminBranch(selectedBranchId, {
                        max_delivery_radius_km: val,
                      });
                      setBranches((prev) =>
                        prev.map((b) => (b.id === selectedBranchId ? { ...b, max_delivery_radius_km: val } : b))
                      );
                      showToast(`Store maximum delivery radius updated to ${val} km`);
                    } catch (err: any) {
                      showToast(err?.message || "Failed to update store radius", "error");
                    }
                  }}
                />
                <span className="text-xs text-slate-500 font-medium">km</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-xs">Loading zones…</div>
      ) : (
        <div className="space-y-6">
          {/* ── DELIVERY AREAS MATRIX (Store Area Matrix Table) ────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-brand-gold" /> Delivery Areas ({zones.length})
                </Heading>
                <Text className="text-xs text-slate-500">
                  Configured service areas for {selectedBranch?.name || "this store"}. Map boundaries (Polygon and Radius) strictly govern customer serviceability.
                </Text>
              </div>
              <Button size="small" onClick={openCreateZone} className="bg-brand-gold hover:bg-brand-gold-dark text-white font-bold text-xs gap-1.5 shadow-sm">
                <Plus className="w-3.5 h-3.5" /> + Add Delivery Area
              </Button>
            </div>

            {zones.length === 0 ? (
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center bg-white dark:bg-slate-800">
                <Truck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                <Text className="text-sm text-slate-500 font-bold">No delivery areas configured</Text>
                <Text className="text-xs text-slate-400 mt-1">Add delivery areas to establish real map-first delivery boundaries for this store.</Text>
                <Button size="small" onClick={openCreateZone} className="mt-3 bg-brand-gold text-white text-xs font-bold">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Create First Delivery Area
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-slate-50 dark:bg-slate-900/60 text-left text-slate-600 dark:text-slate-300 font-semibold">
                      <th className="p-3">Zone / Area Name</th>
                      <th className="p-3">Boundary Type</th>
                      <th className="p-3">Radius / Geometry</th>
                      <th className="p-3">Delivery Pricing</th>
                      <th className="p-3">Delivery Modes</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {zones.map((zone, idx) => {
                      const isRadius = zone.boundary_type === "radius" || zone.fence_type === "radius";
                      const isPolygon = zone.boundary_type === "polygon" || zone.fence_type === "polygon";
                      const hasPolyPoints = zone.polygon_coordinates && (zone.polygon_coordinates as any[]).length >= 3;
                      const isSelected = activeZoneId === zone.id;

                      return (
                        <tr
                          key={zone.id}
                          onClick={() => setActiveZoneId(zone.id)}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-brand-gold-light/70 dark:bg-brand-gold-dark/30"
                              : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                          }`}
                        >
                          <td className="p-3">
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{zone.name}</span>
                              {isSelected && (
                                <span className="text-[9px] bg-brand-gold/40 text-brand-gold-dark dark:bg-brand-gold-dark dark:text-brand-gold px-1.5 py-0.2 rounded font-bold">
                                  Selected
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500">ETA {zone.est_delivery_mins}m · Buffer {zone.preparation_buffer_mins}m</div>
                          </td>

                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isPolygon
                                ? "bg-brand-light text-brand-navy dark:bg-brand-navy dark:text-brand-primary"
                                : isRadius
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                                : "bg-brand-light text-brand-navy dark:bg-brand-navy dark:text-brand-primary"
                            }`}>
                              {zone.boundary_type || zone.fence_type || "hybrid"}
                            </span>
                          </td>

                          <td className="p-3">
                            {isRadius ? (
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {zone.radius_km ?? zone.max_km ?? 5} km
                              </span>
                            ) : hasPolyPoints ? (
                              <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                <Pentagon className="w-3 h-3 text-brand-primary inline" /> {(zone.polygon_coordinates as any[]).length} pts
                                {zone.exclusion_polygons && (zone.exclusion_polygons as any[]).length > 0 && (
                                  <span className="text-[10px] text-rose-600 font-bold ml-1">
                                    (+{(zone.exclusion_polygons as any[]).length} excl)
                                  </span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="p-3">
                            {zone.pricing_type === "distance_bracket" && Array.isArray(zone.pricing_brackets) && zone.pricing_brackets.length > 0 ? (
                              <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1">
                                <Truck className="w-3 h-3 inline" /> {zone.pricing_brackets.length} Brackets (0–{Math.max(...zone.pricing_brackets.map(b => b.max_km))} km)
                              </span>
                            ) : (
                              <span className="text-slate-700 dark:text-slate-300 font-semibold">
                                Flat ₹{zone.delivery_charge}
                              </span>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {zone.same_day_allowed && <span className="text-[9px] bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-1.5 py-0.5 rounded font-bold">SameDay</span>}
                              {zone.express_allowed && <span className="text-[9px] bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/60 dark:text-brand-gold px-1.5 py-0.5 rounded font-bold">Express</span>}
                              
                              {zone.scheduled_allowed && <span className="text-[9px] bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-1.5 py-0.5 rounded font-bold">Slot</span>}
                            </div>
                          </td>

                          <td className="p-3">
                            <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                              {zone.priority ?? 10}
                            </span>
                          </td>

                          <td className="p-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleZoneEnabled(zone);
                              }}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                                zone.enabled
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                              }`}
                            >
                              {zone.enabled ? "ON" : "OFF"}
                            </button>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditZone(zone);
                                }}
                                className="px-2.5 py-1 bg-brand-gold-light text-brand-gold-dark dark:bg-brand-gold-dark/40 dark:text-brand-gold hover:bg-brand-gold-light rounded-lg text-xs font-bold flex items-center gap-1"
                              >
                                <Edit3 className="w-3 h-3" /> Edit
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  duplicateZone(zone);
                                }}
                                className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                                title="Duplicate Zone"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteZone(zone.id);
                                }}
                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
                                title="Delete Zone"
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
                <div className="bg-gradient-to-r from-brand-gold-light to-brand-gold-light dark:from-brand-gold-dark/30 dark:to-brand-gold-dark/20 border-b border-brand-gold/50 px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">{activeZone.name}</Heading>
                      <Badge color={zoneBadgeColor(activeZone)} className="text-[9px]">{activeZone.enabled ? "Active" : "Disabled"}</Badge>
                    </div>
                    <Text className="text-[10px] text-slate-500">{activeZone.min_km}–{activeZone.max_km} km · {activeZone.est_delivery_mins} min ETA · {(activeZone.pincodes ?? []).length} reference pincodes</Text>
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
                      <div className="bg-brand-gold-light dark:bg-brand-gold-dark/30 rounded-lg p-2">
                        <div className="text-[9px] text-slate-500">Express Fee</div>
                        <div className="font-bold text-brand-gold-dark text-sm">₹{activeZone.express_charge}</div>
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

                  {/* Address / Pincode Reference Preview */}
                  <div className="col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500">
                        Address / Pincode Reference ({(activeZone.pincodes ?? []).length})
                      </Text>
                      <button onClick={() => openPincodeManager(activeZone)} className="text-[10px] text-brand-gold font-semibold hover:underline flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Manage Pincodes <ArrowRight className="w-2.5 h-2.5" />
                      </button>
                    </div>
                    {(() => {
                      const hasMap = (activeZone.polygon_coordinates && (activeZone.polygon_coordinates as any[]).length >= 3) || ((activeZone.radius_km ?? activeZone.max_km ?? 0) > 0);
                      if (hasMap) {
                        return (
                          <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-[10px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                            <span>Map boundary active. Coordinates strictly determine real-time delivery serviceability. Pincodes serve only as address reference data.</span>
                          </div>
                        );
                      }
                      return (activeZone.pincodes ?? []).length === 0 ? (
                        <div className="bg-brand-gold-light dark:bg-brand-gold-dark/20 border border-brand-gold/40 rounded-lg p-3 text-[10px] text-brand-gold-dark font-medium flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>No map boundary configured yet. Draw a polygon or set delivery radius on the map below.</span>
                        </div>
                      ) : null;
                    })()}
                    {(activeZone.pincodes ?? []).length > 0 && (
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

                  {/* ── Map Fence Section ─────────────────────────── */}
                  <div className="col-span-2 space-y-2 border-t pt-3">
                    <div className="flex items-center justify-between">
                      <Text className="font-bold text-[10px] uppercase tracking-wide text-slate-500 flex items-center gap-1.5">
                        <Map className="w-3 h-3" /> Map Fence Configuration
                      </Text>
                      <button
                        onClick={() => setShowMapFence(!showMapFence)}
                        className="text-[10px] text-brand-gold font-semibold hover:underline flex items-center gap-1"
                      >
                        {showMapFence ? "Hide Map" : "Show Map"}
                      </button>
                    </div>

                    {!showMapFence ? (
                      <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-[10px] text-blue-600 font-medium flex items-center gap-2">
                        <Map className="w-3.5 h-3.5 shrink-0" />
                        {activeZone.polygon_coordinates && (activeZone.polygon_coordinates as any[]).length >= 3
                          ? `Polygon configured with ${(activeZone.polygon_coordinates as any[]).length} points. Click "Show Map" to edit.`
                          : activeZone.fence_type === "radius"
                            ? `Radius mode: ${activeZone.max_km || 5} km. Click "Show Map" to visualize.`
                            : "No map fence configured. Click \"Show Map\" to draw a delivery zone polygon."}
                      </div>
                    ) : (
                      <MapFenceEditor
                        storeLat={selectedBranch?.latitude || 12.9716}
                        storeLng={selectedBranch?.longitude || 77.5946}
                        storeName={selectedBranch?.name || "Store"}
                        locationSource={selectedBranch?.location_source || "MANUAL_MAP"}
                        locationAccuracy={selectedBranch?.location_accuracy}
                        storeAddress={selectedBranch?.address || selectedBranch?.formatted_address}
                        polygonCoordinates={activeZone.polygon_coordinates as any || []}
                        exclusionPolygons={activeZone.exclusion_polygons as any || []}
                        fenceType={(activeZone.boundary_type || activeZone.fence_type || "hybrid") as any}
                        radiusKm={activeZone.radius_km ?? activeZone.max_km ?? 5}
                        maxRadiusKm={Math.min(
                          25,
                          selectedBranch?.max_delivery_radius_km ?? 25,
                          activeZone.max_serviceable_km ?? (selectedBranch?.max_delivery_radius_km ?? 25)
                        )}
                        zoneName={activeZone.name}
                        onSave={async (data) => {
                          const updatedZones = zones.map((z) =>
                            z.id === activeZone.id
                              ? {
                                  ...z,
                                  polygon_coordinates: data.polygon_coordinates as any,
                                  exclusion_polygons: data.exclusion_polygons as any,
                                  fence_type: data.fence_type as any,
                                  boundary_type: data.fence_type as any,
                                  radius_km: data.radius_km ?? z.radius_km ?? z.max_km,
                                  max_km: data.radius_km ?? z.max_km,
                                }
                              : z
                          );
                          await persistZones(updatedZones);
                        }}
                        onStoreLocationChange={async (lat, lng, source, accuracy, address) => {
                          try {
                            await apiClient.updateAdminBranch(selectedBranchId, {
                              latitude: lat,
                              longitude: lng,
                              location_source: source || "MANUAL_MAP",
                              location_accuracy: accuracy ?? null,
                              formatted_address: address || selectedBranch?.formatted_address,
                            });
                            setBranches((prev) =>
                              prev.map((b) =>
                                b.id === selectedBranchId
                                  ? {
                                      ...b,
                                      latitude: lat,
                                      longitude: lng,
                                      location_source: source || "MANUAL_MAP",
                                      location_accuracy: accuracy ?? null,
                                      formatted_address: address || b.formatted_address,
                                      has_valid_location: true,
                                    }
                                  : b
                              )
                            );
                            showToast(`Store physical location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                          } catch (err: any) {
                            showToast(`Failed to update store location: ${err.message}`, "error");
                          }
                        }}
                      />
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center justify-between z-10">
              <div>
                <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Map className="w-4 h-4 text-brand-gold" />
                  {editingZone ? `Edit Delivery Area: ${editingZone.name}` : "Create New Delivery Area"}
                </Heading>
                <Text className="text-[11px] text-slate-500">
                  Configure delivery boundary directly on the map. Coordinates strictly determine customer serviceability.
                </Text>
              </div>
              <button onClick={() => setShowZoneModal(false)} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSaveZone} className="p-5 space-y-5">
              {/* Basic Info */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Area Boundary Configuration</Text>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">Area / Zone Name *</Label>
                    <Input value={zoneForm.name} onChange={(e) => zf("name", e.target.value)} placeholder="e.g. Central Delivery Zone" required />
                  </div>
                  <div>
                    <Label className="text-xs">Boundary Type</Label>
                    <select
                      value={zoneForm.fence_type || "hybrid"}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        zf("fence_type", val);
                        zf("boundary_type", val);
                      }}
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                    >
                      <option value="polygon">Polygon (Geofence &amp; Exclusions)</option>
                      <option value="radius">Radius (Store-centered Circle)</option>
                      <option value="hybrid">Hybrid (Polygon + Radius)</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Priority (Lower = Higher Priority)</Label>
                    <Input type="number" min={1} max={100} value={zoneForm.priority ?? 10} onChange={(e) => zf("priority", parseInt(e.target.value) || 10)} />
                  </div>

                  {(zoneForm.fence_type === "radius" || zoneForm.fence_type === "hybrid" || zoneForm.boundary_type === "radius" || zoneForm.boundary_type === "hybrid") && (
                    <div>
                      <Label className="text-xs">Delivery Radius (KM)</Label>
                      <Input
                        type="number"
                        min={0.5}
                        max={selectedBranch?.max_delivery_radius_km ?? 25}
                        step={0.5}
                        value={zoneForm.radius_km ?? zoneForm.max_km ?? 5}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 5;
                          zf("radius_km", val);
                          zf("max_km", val);
                        }}
                      />
                    </div>
                  )}

                  <div>
                    <Label className="text-xs">Est. Delivery Time (mins)</Label>
                    <Input type="number" min={1} value={zoneForm.est_delivery_mins} onChange={(e) => zf("est_delivery_mins", parseInt(e.target.value) || 45)} />
                  </div>
                  <div>
                    <Label className="text-xs">Kitchen Prep Buffer (mins)</Label>
                    <Input type="number" min={0} value={zoneForm.preparation_buffer_mins} onChange={(e) => zf("preparation_buffer_mins", parseInt(e.target.value) || 15)} />
                  </div>
                </div>

                {/* Constraint & Limit Safety Indicator */}
                {(() => {
                  const storeMax = selectedBranch?.max_delivery_radius_km ?? 15;
                  const zoneMax = zoneForm.max_serviceable_km || storeMax;
                  const effectiveMax = Math.min(25, storeMax, zoneMax);
                  const currentR = zoneForm.radius_km ?? zoneForm.max_km ?? 5;
                  const exceeds = zoneForm.fence_type !== "polygon" && currentR > effectiveMax;
                  return (
                    <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center justify-between ${exceeds ? "bg-rose-50 text-rose-700 border border-rose-200" : "bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
                      <span>
                        Store Max Radius: <strong>{storeMax} km</strong> · Effective Allowed Limit: <strong>{effectiveMax} km</strong> · Remaining: <strong>{Math.max(0, effectiveMax - currentR).toFixed(1)} km</strong>
                      </span>
                      {exceeds && (
                        <span className="font-bold text-rose-600 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Exceeds maximum limit!
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* ── Direct Interactive Map Editor in Modal ── */}
                <div className="space-y-1.5 mt-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Map className="w-3.5 h-3.5 text-brand-gold" /> Interactive Map Boundary Editor
                    </Label>
                    <span className="text-[10px] text-slate-500">
                      {zoneForm.fence_type === "radius" ? "Adjust radius slider/circle live on map" : "Draw polygon boundaries and exclusion sub-polygons"}
                    </span>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-inner bg-slate-100 dark:bg-slate-800">
                    <MapFenceEditor
                      storeLat={selectedBranch?.latitude || 12.9716}
                      storeLng={selectedBranch?.longitude || 77.5946}
                      storeName={selectedBranch?.name || "Store"}
                      locationSource={selectedBranch?.location_source || "MANUAL_MAP"}
                      locationAccuracy={selectedBranch?.location_accuracy}
                      storeAddress={selectedBranch?.address || selectedBranch?.formatted_address}
                      polygonCoordinates={zoneForm.polygon_coordinates as any || []}
                      exclusionPolygons={zoneForm.exclusion_polygons as any || []}
                      fenceType={(zoneForm.boundary_type || zoneForm.fence_type || "hybrid") as any}
                      radiusKm={zoneForm.radius_km ?? zoneForm.max_km ?? 5}
                      maxRadiusKm={Math.min(
                        25,
                        selectedBranch?.max_delivery_radius_km ?? 25,
                        zoneForm.max_serviceable_km ?? (selectedBranch?.max_delivery_radius_km ?? 25)
                      )}
                      zoneName={zoneForm.name || "New Delivery Area"}
                      onPolygonChange={(coords) => zf("polygon_coordinates" as any, coords)}
                      onExclusionChange={(excls) => zf("exclusion_polygons" as any, excls)}
                      onRadiusChange={(r) => {
                        zf("radius_km" as any, r);
                        zf("max_km" as any, r);
                      }}
                      onStoreLocationChange={async (lat, lng, source, accuracy, address) => {
                        try {
                          await apiClient.updateAdminBranch(selectedBranchId, {
                            latitude: lat,
                            longitude: lng,
                            location_source: source || "MANUAL_MAP",
                            location_accuracy: accuracy ?? null,
                            formatted_address: address || selectedBranch?.formatted_address,
                          });
                          setBranches((prev) =>
                            prev.map((b) =>
                              b.id === selectedBranchId
                                ? {
                                    ...b,
                                    latitude: lat,
                                    longitude: lng,
                                    location_source: source || "MANUAL_MAP",
                                    location_accuracy: accuracy ?? null,
                                    formatted_address: address || b.formatted_address,
                                    has_valid_location: true,
                                  }
                                : b
                            )
                          );
                          showToast(`Store physical location updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                        } catch (err: any) {
                          showToast(`Failed to update store location: ${err.message}`, "error");
                        }
                      }}
                      onSave={(data) => {
                        zf("polygon_coordinates" as any, data.polygon_coordinates);
                        zf("exclusion_polygons" as any, data.exclusion_polygons);
                        zf("fence_type" as any, data.fence_type);
                        zf("boundary_type" as any, data.fence_type);
                        if (data.radius_km) {
                          zf("radius_km" as any, data.radius_km);
                          zf("max_km" as any, data.radius_km);
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <Text className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-3">Pricing</Text>

                {/* Pricing Mode Toggle */}
                <div className="flex items-center gap-3 mb-4 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                  <Text className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">Pricing Mode:</Text>
                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-md p-0.5 border border-slate-200 dark:border-slate-600">
                    <button
                      type="button"
                      onClick={() => zf("pricing_type" as any, "flat")}
                      className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                        (!zoneForm.pricing_type || zoneForm.pricing_type === "flat")
                          ? "bg-brand-primary text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <DollarSign className="w-3 h-3 inline mr-1" />Flat Rate
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        zf("pricing_type" as any, "distance_bracket");
                        // Initialize default brackets if none exist
                        if (!zoneForm.pricing_brackets || (zoneForm.pricing_brackets as any[]).length === 0) {
                          zf("pricing_brackets" as any, [
                            { min_km: 0,  max_km: 3,  charge: 39,  label: "0–3 km",   enabled: true },
                            { min_km: 3,  max_km: 5,  charge: 49,  label: "3–5 km",   enabled: true },
                            { min_km: 5,  max_km: 8,  charge: 69,  label: "5–8 km",   enabled: true },
                            { min_km: 8,  max_km: 12, charge: 99,  label: "8–12 km",  enabled: true },
                            { min_km: 12, max_km: 15, charge: 149, label: "12–15 km", enabled: true },
                          ]);
                        }
                      }}
                      className={`px-3 py-1 rounded text-[10px] font-bold transition-colors ${
                        zoneForm.pricing_type === "distance_bracket"
                          ? "bg-emerald-500 text-white" : "text-slate-500 hover:bg-slate-100"
                      }`}
                    >
                      <Truck className="w-3 h-3 inline mr-1" />Distance Brackets
                    </button>
                  </div>
                </div>

                {/* Flat Rate Pricing */}
                {(!zoneForm.pricing_type || zoneForm.pricing_type === "flat") && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <Label className="text-xs">Delivery Fee (₹)</Label>
                      <Input type="number" min={0} value={zoneForm.delivery_charge} onChange={(e) => zf("delivery_charge", parseFloat(e.target.value) || 0)} />
                    </div>
                  </div>
                )}

                {/* Distance Bracket Pricing */}
                {zoneForm.pricing_type === "distance_bracket" && (
                  <div className="mb-3">
                    <div className="space-y-2 mb-3">
                      {((zoneForm as any).pricing_brackets || []).map((bracket: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              type="number" min={0} step={0.5}
                              value={bracket.min_km}
                              onChange={(e) => {
                                const brackets = [...((zoneForm as any).pricing_brackets || [])];
                                brackets[idx] = { ...brackets[idx], min_km: parseFloat(e.target.value) || 0 };
                                zf("pricing_brackets" as any, brackets);
                              }}
                              className="w-16 text-xs"
                            />
                            <span className="text-[10px] text-slate-400">–</span>
                            <Input
                              type="number" min={0} step={0.5}
                              value={bracket.max_km}
                              onChange={(e) => {
                                const brackets = [...((zoneForm as any).pricing_brackets || [])];
                                brackets[idx] = { ...brackets[idx], max_km: parseFloat(e.target.value) || 0 };
                                zf("pricing_brackets" as any, brackets);
                              }}
                              className="w-16 text-xs"
                            />
                            <span className="text-[10px] text-slate-400 font-medium">km</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">₹</span>
                            <Input
                              type="number" min={0}
                              value={bracket.charge}
                              onChange={(e) => {
                                const brackets = [...((zoneForm as any).pricing_brackets || [])];
                                brackets[idx] = { ...brackets[idx], charge: parseFloat(e.target.value) || 0 };
                                zf("pricing_brackets" as any, brackets);
                              }}
                              className="w-20 text-xs"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const brackets = [...((zoneForm as any).pricing_brackets || [])];
                              brackets.splice(idx, 1);
                              zf("pricing_brackets" as any, brackets);
                            }}
                            className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const brackets = [...((zoneForm as any).pricing_brackets || [])];
                        const lastMax = brackets.length > 0 ? brackets[brackets.length - 1].max_km : 0;
                        const storeMax = selectedBranch?.max_delivery_radius_km ?? 15;
                        const effectiveMax = Math.min(25, storeMax, zoneForm.max_serviceable_km || storeMax);
                        const nextMax = Math.min(lastMax + 5, effectiveMax);
                        if (lastMax >= effectiveMax) {
                          showToast(`Cannot add bracket beyond effective delivery radius (${effectiveMax} km).`, "error");
                          return;
                        }
                        brackets.push({ min_km: lastMax, max_km: nextMax, charge: 0, label: "", enabled: true });
                        zf("pricing_brackets" as any, brackets);
                      }}
                      className="px-3 py-1.5 rounded-md text-[10px] font-bold flex items-center gap-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 border border-dashed border-emerald-300 dark:border-emerald-700 w-full justify-center"
                    >
                      <Plus className="w-3 h-3" /> Add Distance Bracket
                    </button>
                    <div className="mt-2">
                      <Label className="text-xs text-slate-400">Flat-rate fallback (₹) — used when distance exceeds all brackets</Label>
                      <Input type="number" min={0} value={zoneForm.delivery_charge} onChange={(e) => zf("delivery_charge", parseFloat(e.target.value) || 0)} className="mt-1" />
                    </div>
                  </div>
                )}

                {/* Surcharges (applicable in both modes) */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Express Surcharge (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.express_charge} onChange={(e) => zf("express_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  
                  <div>
                    <Label className="text-xs">Holiday Surcharge (₹)</Label>
                    <Input type="number" min={0} value={zoneForm.holiday_charge ?? 0} onChange={(e) => zf("holiday_charge", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div>
                    <Label className="text-xs">Free Delivery Threshold (₹, 0 = off)</Label>
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
                  className={`px-5 py-2.5 text-xs font-semibold transition-colors capitalize ${pincodeTab === t ? "border-b-2 border-brand-gold text-brand-gold" : "text-slate-500 hover:text-slate-800"}`}
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
                      className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-brand-gold outline-none resize-y"
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
                        <span key={s} className="flex items-center gap-1 bg-brand-gold-light text-brand-gold-dark text-[10px] font-semibold px-2 py-1 rounded-full">
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
