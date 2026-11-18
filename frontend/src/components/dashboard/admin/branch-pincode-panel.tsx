"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { BranchZoneManager } from "./branch-zone-manager";
import { DeliverySimulator } from "./delivery-simulator";
import { ArrowRightLeft, Compass, FolderTree, Layers, MapPin, Search, Settings2, Upload } from "lucide-react";

export function BranchPincodePanel() {
  const [activeTab, setActiveTab] = useState<"zones" | "simulator" | "matrix" | "service_areas">("zones");
  const [cityAreas, setCityAreas] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [pincodeMappings, setPincodeMappings] = useState<any[]>([]);
  const [serviceAreas, setServiceAreas] = useState<any[]>([
    { id: "serv_hsr_1", area_name: "HSR Layout", service_area_name: "HSR Sector 1 & 2 Hub Region", pincodes: ["560102", "560068"], branch_code: "HUB-BLR-03", status: "active" },
    { id: "serv_indira_center", area_name: "Indiranagar", service_area_name: "100 Feet Rd & CMH Corridor", pincodes: ["560038", "560008", "560071"], branch_code: "HUB-BLR-01", status: "active" },
    { id: "serv_koramangala_5th", area_name: "Koramangala", service_area_name: "Koramangala 4th & 5th Block", pincodes: ["560034", "560095"], branch_code: "HUB-BLR-02", status: "active" },
    { id: "serv_whitefield_itpl", area_name: "Whitefield", service_area_name: "ITPL Main Rd & Brookefield", pincodes: ["560066", "560048"], branch_code: "HUB-BLR-04", status: "active" },
  ]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Delivery Zone Form Modal
  const [showZoneModal, setShowZoneModal] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("br_indiranagar");
  const [editingZone, setEditingZone] = useState<any | null>(null);
  
  const [zoneName, setZoneName] = useState("Zone 1 (0-5 KM)");
  const [minKm, setMinKm] = useState("0");
  const [maxKm, setMaxKm] = useState("5");
  const [estDeliveryMins, setEstDeliveryMins] = useState("45");
  const [prepBufferMins, setPrepBufferMins] = useState("30");
  const [sameDayAllowed, setSameDayAllowed] = useState(true);
  const [expressAllowed, setExpressAllowed] = useState(true);
  const [midnightAllowed, setMidnightAllowed] = useState(false);
  const [scheduledAllowed, setScheduledAllowed] = useState(true);
  const [maxCakeWeightKg, setMaxCakeWeightKg] = useState("10");
  const [minOrderValue, setMinOrderValue] = useState("0");
  const [freeDeliveryThreshold, setFreeDeliveryThreshold] = useState("499");
  const [deliveryCharge, setDeliveryCharge] = useState("49");
  const [expressCharge, setExpressCharge] = useState("99");
  const [midnightCharge, setMidnightCharge] = useState("0");

  // Move Pincode Modal
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [movingPincode, setMovingPincode] = useState<string>("");
  const [targetBranchId, setTargetBranchId] = useState<string>("br_indiranagar");
  const [targetZoneId, setTargetZoneId] = useState<string>("zone_1");

  // Bulk Import Modal
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkCsvText, setBulkCsvText] = useState("560038, br_indiranagar, zone_1\n560068, br_hsr, zone_2");


  
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminBranches();
      setCityAreas(res?.cityAreas || []);
      setBranches(res?.branches || []);
      
      setPincodeMappings(res?.pincodeMappings || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedBranch = branches.find((b) => b.id === selectedBranchId) || branches[0] || {
    id: "br_indiranagar",
    name: "Indiranagar Flagship Bakery",
    code: "HUB-BLR-01",
    delivery_zones: [
      { id: "zone_1", name: "Zone 1 (0-5 KM)", min_km: 0, max_km: 5, delivery_charge: 49, express_charge: 99, midnight_charge: 149, est_delivery_mins: 45, same_day_allowed: true, express_allowed: true, midnight_allowed: false, scheduled_allowed: true },
      { id: "zone_2", name: "Zone 2 (5-10 KM)", min_km: 5, max_km: 10, delivery_charge: 69, express_charge: 129, midnight_charge: 179, est_delivery_mins: 60, same_day_allowed: true, express_allowed: true, midnight_allowed: false, scheduled_allowed: true },
      { id: "zone_3", name: "Zone 3 (10-15 KM)", min_km: 10, max_km: 15, delivery_charge: 99, express_charge: 199, midnight_charge: 249, est_delivery_mins: 90, same_day_allowed: true, express_allowed: false, midnight_allowed: false, scheduled_allowed: true },
    ]
  };

  const handleOpenCreateZone = () => {
    setEditingZone(null);
    setZoneName(`Zone ${(selectedBranch?.delivery_zones?.length || 0) + 1}`);
    setMinKm(String((selectedBranch?.delivery_zones?.length || 0) * 5));
    setMaxKm(String(((selectedBranch?.delivery_zones?.length || 0) + 1) * 5));
    setEstDeliveryMins("45");
    setPrepBufferMins("30");
    setSameDayAllowed(true);
    setExpressAllowed(true);
    setMidnightAllowed(false);
    setScheduledAllowed(true);
    setMaxCakeWeightKg("10");
    setMinOrderValue("0");
    setFreeDeliveryThreshold("499");
    setDeliveryCharge("49");
    setExpressCharge("99");
    setMidnightCharge("0");
    setShowZoneModal(true);
  };

  const handleOpenEditZone = (z: any) => {
    setEditingZone(z);
    setZoneName(z.name);
    setMinKm(String(z.min_km));
    setMaxKm(String(z.max_km));
    setEstDeliveryMins(String(z.est_delivery_mins || 45));
    setPrepBufferMins(String(z.preparation_buffer_mins || 30));
    setSameDayAllowed(z.same_day_allowed !== false);
    setExpressAllowed(z.express_allowed !== false);
    setMidnightAllowed(false);
    setScheduledAllowed(z.scheduled_allowed !== false);
    setMaxCakeWeightKg(String(z.max_cake_weight_kg || 10));
    setMinOrderValue(String(z.min_order_value || 0));
    setFreeDeliveryThreshold(String(z.free_delivery_threshold || 499));
    setDeliveryCharge(String(z.delivery_charge || 49));
    setExpressCharge(String(z.express_charge || 99));
    setMidnightCharge(String(z.midnight_charge || 149));
    setShowZoneModal(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      id: editingZone?.id,
      name: zoneName,
      min_km: parseFloat(minKm) || 0,
      max_km: parseFloat(maxKm) || 5,
      enabled: true,
      est_delivery_mins: parseInt(estDeliveryMins, 10) || 45,
      preparation_buffer_mins: parseInt(prepBufferMins, 10) || 30,
      same_day_allowed: sameDayAllowed,
      express_allowed: expressAllowed,
      midnight_allowed: false,
      scheduled_allowed: scheduledAllowed,
      max_cake_weight_kg: parseFloat(maxCakeWeightKg) || 10,
      min_order_value: parseFloat(minOrderValue) || 0,
      free_delivery_threshold: parseFloat(freeDeliveryThreshold) || 499,
      delivery_charge: parseFloat(deliveryCharge) || 49,
      express_charge: parseFloat(expressCharge) || 99,
      midnight_charge: 0,
    };

    try {
      await apiClient.saveBranchZone(selectedBranchId, payload);
      setShowZoneModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to save zone");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteZone = async (zoneId: string) => {
    if (!confirm("Are you sure you want to delete this delivery zone?")) return;
    try {
      await apiClient.deleteBranchZone(selectedBranchId, zoneId);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to delete zone");
    }
  };

  const handleOpenMoveModal = (pin: string) => {
    setMovingPincode(pin);
    setTargetBranchId(selectedBranchId || "br_indiranagar");
    setTargetZoneId("zone_1");
    setShowMoveModal(true);
  };

  const handleExecuteMovePincode = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiClient.movePincodeZone(movingPincode, targetBranchId, targetZoneId);
      setShowMoveModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to move pincode");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExecuteBulkImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const lines = bulkCsvText.split("\n").map((l) => l.trim()).filter(Boolean);
    const list = lines.map((l) => {
      const parts = l.split(",").map((p) => p.trim());
      return { pincode: parts[0], branch_id: parts[1] || "br_indiranagar", zone_id: parts[2] || "zone_1" };
    });
    try {
      await apiClient.bulkImportPincodes(list);
      alert(`Successfully imported ${list.length} pincode mappings!`);
      setShowBulkModal(false);
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to bulk import pincodes");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMappings = pincodeMappings.filter((m) => {
    const q = search.toLowerCase();
    return m.pincode.includes(q) || m.area_name.toLowerCase().includes(q) || m.branch_code.toLowerCase().includes(q) || m.zone_name.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand-gold-light/70 dark:bg-slate-800/80 p-4 rounded-xl border border-brand-gold/40 dark:border-slate-700">
        <div>
          <Heading level="h2" className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <MapPin className="w-5 h-5 text-brand-gold" /> Store Area Matrix &amp; Map-First Delivery Management
          </Heading>
          <Text className="text-xs text-slate-600 dark:text-slate-300">
            The central delivery configuration screen. Configure geographic delivery boundaries directly on the map (Polygon and Radius). Coordinates are strictly authoritative.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            color={activeTab === "zones" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            onClick={() => setActiveTab("zones")}
          >
            <Layers className="w-3.5 h-3.5" /> Store Area Matrix
          </Badge>
          <Badge
            color={activeTab === "simulator" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            onClick={() => setActiveTab("simulator")}
          >
            <Compass className="w-3.5 h-3.5 text-brand-gold" /> Routing Simulator
          </Badge>
          <Badge
            color={activeTab === "matrix" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            onClick={() => setActiveTab("matrix")}
          >
            <FolderTree className="w-3.5 h-3.5" /> Address / Pincode Reference
          </Badge>
          <Badge
            color={activeTab === "service_areas" ? "purple" : "grey"}
            className="cursor-pointer px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5"
            onClick={() => setActiveTab("service_areas")}
          >
            <Settings2 className="w-3.5 h-3.5" /> Service Areas
          </Badge>
        </div>
      </div>

      {activeTab === "matrix" && (
        <div className="space-y-4">
          <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-200 flex items-start gap-2.5">
            <span className="text-base">ℹ️</span>
            <div>
              <strong>Address / Pincode Reference:</strong> Pincodes are stored for address/reference purposes. Delivery eligibility is determined by map location.
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative max-w-md w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                placeholder="Search pincode, area, zone, or branch code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button size="small" variant="secondary" onClick={() => setShowBulkModal(true)} className="text-xs">
                <Upload className="w-3.5 h-3.5 mr-1" /> Bulk CSV Import
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-ui-bg-subtle text-left">
                  <th className="p-3 font-semibold">Pincode</th>
                  <th className="p-3 font-semibold">Area / Locality</th>
                  <th className="p-3 font-semibold">Assigned Branch</th>
                  <th className="p-3 font-semibold">Assigned Delivery Zone</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredMappings.map((m) => (
                  <tr key={m.pincode} className="hover:bg-ui-bg-subtle-hover">
                    <td className="p-3 font-mono font-bold text-emerald-700 dark:text-emerald-300">📍 {m.pincode}</td>
                    <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{m.area_name}, {m.city_name}</td>
                    <td className="p-3">
                      <Badge color="purple" className="font-bold text-[10px]">{m.branch_code}</Badge>
                    </td>
                    <td className="p-3 font-semibold text-blue-600">{m.zone_name}</td>
                    <td className="p-3">
                      <Badge color="green" className="text-[10px] uppercase font-bold">Active</Badge>
                    </td>
                    <td className="p-3 text-right">
                      <Button size="small" variant="transparent" onClick={() => handleOpenMoveModal(m.pincode)} className="text-[10px] text-brand-gold font-bold">
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Transfer Zone
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "zones" && <BranchZoneManager />}
      {activeTab === "simulator" && <DeliverySimulator />}

      {/* SERVICE AREAS TAB */}
      {activeTab === "service_areas" && (
        <div className="space-y-4">
          <div className="p-4 bg-brand-light/70 dark:bg-brand-navy/30 border border-brand-primary/30 rounded-xl flex items-center justify-between">
            <div>
              <Heading level="h3" className="text-sm font-bold text-brand-navy dark:text-brand-primary flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-brand-primary" /> Operational Service Areas ({serviceAreas.length})
              </Heading>
              <Text className="text-xs text-brand-navy dark:text-brand-primary">
                Service Areas group multiple pincodes into operational regions for easy management and routing.
              </Text>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serviceAreas.map((sa) => (
              <div key={sa.id} className="p-4 bg-white dark:bg-slate-900 border rounded-xl space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm text-slate-900 dark:text-white">{sa.service_area_name}</span>
                    <span className="block text-xs text-slate-500">{sa.area_name} • Branch Code: <strong className="text-brand-primary">{sa.branch_code}</strong></span>
                  </div>
                  <Badge color="green" className="capitalize text-[10px] font-bold">{sa.status}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {sa.pincodes.map((pin: string) => (
                    <span key={pin} className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded text-xs font-mono font-bold">
                      📍 {pin}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {showZoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-8">
            <div className="p-4 border-b flex items-center justify-between bg-brand-gold-light dark:bg-brand-gold-dark/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-primary" />
                {editingZone ? `Configure Zone: ${editingZone.name}` : "Create Delivery Zone"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowZoneModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSaveZone} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Zone Name *</Label>
                  <Input value={zoneName} onChange={(e) => setZoneName(e.target.value)} required />
                </div>
                <div>
                  <Label>Est. Delivery Time (Minutes) *</Label>
                  <Input type="number" value={estDeliveryMins} onChange={(e) => setEstDeliveryMins(e.target.value)} required />
                </div>

                <div>
                  <Label>Min Distance (KM)</Label>
                  <Input type="number" value={minKm} onChange={(e) => setMinKm(e.target.value)} required />
                </div>
                <div>
                  <Label>Max Distance (KM)</Label>
                  <Input type="number" value={maxKm} onChange={(e) => setMaxKm(e.target.value)} required />
                </div>

                <div>
                  <Label>Base Delivery Charge (₹)</Label>
                  <Input type="number" value={deliveryCharge} onChange={(e) => setDeliveryCharge(e.target.value)} required />
                </div>
                <div>
                  <Label>Express Surcharge (₹)</Label>
                  <Input type="number" value={expressCharge} onChange={(e) => setExpressCharge(e.target.value)} required />
                </div>

                
                <div>
                  <Label>Preparation Buffer (Minutes)</Label>
                  <Input type="number" value={prepBufferMins} onChange={(e) => setPrepBufferMins(e.target.value)} required />
                </div>

                <div className="sm:col-span-2 pt-2 border-t flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={sameDayAllowed} onChange={(e) => setSameDayAllowed(e.target.checked)} className="rounded" />
                    <span>Same Day Allowed</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={expressAllowed} onChange={(e) => setExpressAllowed(e.target.checked)} className="rounded" />
                    <span>Express Allowed</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={scheduledAllowed} onChange={(e) => setScheduledAllowed(e.target.checked)} className="rounded" />
                    <span>Scheduled Allowed</span>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowZoneModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-brand-primary hover:bg-brand-navy text-white font-bold">
                  Save Zone Configuration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-brand-gold-light dark:bg-brand-gold-dark/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-brand-gold" />
                Transfer Pincode {movingPincode}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowMoveModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleExecuteMovePincode} className="p-5 space-y-4 text-xs">
              <div>
                <Label>Target Fulfillment Branch *</Label>
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                  ))}
                </select>
              </div>

              <div>
                <Label>Target Delivery Zone *</Label>
                <select
                  value={targetZoneId}
                  onChange={(e) => setTargetZoneId(e.target.value)}
                  className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                >
                  <option value="zone_1">Zone 1 (0-5 KM)</option>
                  <option value="zone_2">Zone 2 (5-10 KM)</option>
                  <option value="zone_3">Zone 3 (10-15 KM)</option>
                  <option value="zone_4">Zone 4 (15-20 KM)</option>
                </select>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowMoveModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-brand-gold hover:bg-brand-gold-dark text-white font-bold">
                  Confirm Transfer
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-600" />
                Bulk Import Pincode Mappings
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowBulkModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleExecuteBulkImport} className="p-5 space-y-4 text-xs">
              <div>
                <Label>Paste CSV Lines (Format: pincode, branch_id, zone_id)</Label>
                <textarea
                  rows={6}
                  value={bulkCsvText}
                  onChange={(e) => setBulkCsvText(e.target.value)}
                  className="w-full p-2.5 text-xs font-mono rounded-lg border bg-white dark:bg-slate-900"
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowBulkModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  Import Mappings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
