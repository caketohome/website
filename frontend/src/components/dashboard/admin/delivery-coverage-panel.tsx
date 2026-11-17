"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MapPin, Shield, CheckCircle2, XCircle, AlertTriangle, Search,
  Plus, Edit2, Trash2, RefreshCw, Eye, Navigation, Truck,
  Layers, Lock, Filter, Compass, Info, ArrowRight, CornerDownRight,
  ChevronRight, Building2, UserCheck, ShieldAlert, Sparkles, Check
} from "lucide-react";

// Types
export interface StoreSummary {
  id: string;
  name: string;
  code: string;
  is_open: boolean;
  is_corporate_routing_eligible: boolean;
  city_name: string | null;
  latitude: number;
  longitude: number;
  zones_count: number;
  polygon_zones_count: number;
  radius_zones_count: number;
  has_exclusions: boolean;
  active_partners_count: number;
}

export interface ZoneItem {
  id: string;
  branch_id: string;
  name: string | null;
  pincode: string;
  delivery_fee: number;
  is_serviceable: boolean;
  polygon_coordinates: Array<[number, number]> | null;
  exclusion_polygons: Array<Array<[number, number]>> | null;
  radius_km: number | null;
  center_latitude: number | null;
  center_longitude: number | null;
  priority: number;
  estimated_delivery_minutes: number;
}

export interface PartnerSummary {
  id: string;
  partner_id: string;
  partner_name: string;
  partner_email?: string;
  partner_phone?: string;
  partner_type: "OWN_FLEET" | "COURIER" | "3PL_AGGREGATOR";
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
  primary_branch_id: string | null;
  primary_branch_name: string | null;
  max_concurrent_orders: number;
  rating: number;
  contract_reference?: string;
  metadata?: Record<string, any>;
}

export interface PartnerCoverage {
  id: string;
  partner_id: string;
  branch_id: string;
  branch_name?: string;
  fence_type: "POLYGON" | "RADIUS" | "HYBRID";
  polygon_coordinates: Array<[number, number]>;
  radius_km: number | null;
  priority: number;
  is_active: boolean;
}

export interface AuditEventItem {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor_id: string;
  actor_role: string;
  reason: string;
  before_state: any;
  after_state: any;
  created_at: string;
}

export function DeliveryCoveragePanel() {
  const [activeTab, setActiveTab] = useState<"stores" | "partners" | "probe" | "audit">("stores");
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [partners, setPartners] = useState<PartnerSummary[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [storeSearch, setStoreSearch] = useState("");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [auditFilter, setAuditFilter] = useState<string>("ALL");

  // Selected Store for Zones Modal
  const [selectedStoreForZones, setSelectedStoreForZones] = useState<StoreSummary | null>(null);
  const [storeZones, setStoreZones] = useState<ZoneItem[]>([]);
  const [loadingZones, setLoadingZones] = useState<boolean>(false);

  // Eligibility Toggle Modal
  const [eligibilityModalStore, setEligibilityModalStore] = useState<StoreSummary | null>(null);
  const [eligibilityReason, setEligibilityReason] = useState("");
  const [submittingEligibility, setSubmittingEligibility] = useState(false);

  // Zone Create/Edit Modal
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [zoneFormData, setZoneFormData] = useState({
    name: "",
    pincode: "560001",
    delivery_fee: 50,
    radius_km: 8.5,
    polygon_json: "",
    exclusion_json: "",
    is_serviceable: true,
    reason: "",
  });

  // Partner Profile Modal
  const [selectedPartnerForEdit, setSelectedPartnerForEdit] = useState<PartnerSummary | null>(null);
  const [partnerFormData, setPartnerFormData] = useState({
    partner_type: "OWN_FLEET",
    status: "ACTIVE",
    max_concurrent_orders: 5,
    primary_branch_id: "",
    supports_cold_chain: false,
    reason: "",
  });

  // Partner Coverage Modal
  const [selectedPartnerForCoverage, setSelectedPartnerForCoverage] = useState<PartnerSummary | null>(null);
  const [partnerCoverageList, setPartnerCoverageList] = useState<PartnerCoverage[]>([]);
  const [loadingPartnerCoverage, setLoadingPartnerCoverage] = useState(false);
  const [partnerCoverageFormData, setPartnerCoverageFormData] = useState({
    fence_type: "POLYGON",
    branch_id: "",
    radius_km: 10,
    polygon_json: "",
    is_active: true,
    reason: "",
  });

  // Diagnostic Probe State
  const [probeLat, setProbeLat] = useState("12.9716");
  const [probeLng, setProbeLng] = useState("77.6412");
  const [probeStoreId, setProbeStoreId] = useState("");
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);
  const [corporateResolution, setCorporateResolution] = useState<any>(null);

  // Event Detail Modal
  const [selectedAuditEvent, setSelectedAuditEvent] = useState<AuditEventItem | null>(null);

  // Auto-dismiss banners
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Load Primary Data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [storesRes, partnersRes, eventsRes] = await Promise.all([
        fetch("/api/v1/admin/delivery-coverage/stores").then((r) => r.json()),
        fetch("/api/v1/admin/delivery-coverage/partners").then((r) => r.json()),
        fetch("/api/v1/admin/delivery-coverage/events?limit=40").then((r) => r.json()),
      ]);

      if (storesRes.success) setStores(storesRes.stores || []);
      if (partnersRes.success) setPartners(partnersRes.partners || []);
      if (eventsRes.success) setAuditEvents(eventsRes.events || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load delivery coverage data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Load zones when a store is selected
  const loadStoreZones = async (store: StoreSummary) => {
    setSelectedStoreForZones(store);
    setLoadingZones(true);
    try {
      const res = await fetch(`/api/v1/admin/delivery-coverage/stores/${store.id}/zones`).then((r) => r.json());
      if (res.success) {
        setStoreZones(res.zones || []);
      }
    } catch (err) {
      console.error("Failed to load store zones:", err);
    } finally {
      setLoadingZones(false);
    }
  };

  // Load partner coverage boundaries
  const loadPartnerCoverage = async (partner: PartnerSummary) => {
    setSelectedPartnerForCoverage(partner);
    setLoadingPartnerCoverage(true);
    try {
      const res = await fetch(`/api/v1/admin/delivery-coverage/partners/${partner.partner_id}/coverage`).then((r) => r.json());
      if (res.success) {
        setPartnerCoverageList(res.coverage || []);
      }
    } catch (err) {
      console.error("Failed to load partner coverage:", err);
    } finally {
      setLoadingPartnerCoverage(false);
    }
  };

  // Toggle Store Corporate Eligibility
  const handleToggleEligibility = async () => {
    if (!eligibilityModalStore) return;
    if (eligibilityReason.trim().length < 5) {
      alert("A reason of at least 5 characters is strictly required for audit compliance.");
      return;
    }

    setSubmittingEligibility(true);
    try {
      const nextEligible = !eligibilityModalStore.is_corporate_routing_eligible;
      const res = await fetch(`/api/v1/admin/delivery-coverage/stores/${eligibilityModalStore.id}/eligibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_eligible: nextEligible,
          reason: eligibilityReason,
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSuccessMsg(`Store "${eligibilityModalStore.name}" corporate routing eligibility updated to ${nextEligible ? "ELIGIBLE" : "INACTIVE"}.`);
        setEligibilityModalStore(null);
        setEligibilityReason("");
        await fetchData();
      } else {
        alert(res.error || "Failed to update corporate eligibility.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update corporate eligibility.");
    } finally {
      setSubmittingEligibility(false);
    }
  };

  // Save Zone Form (Create or Update)
  const handleSaveZone = async () => {
    if (!selectedStoreForZones) return;
    if (!zoneFormData.name.trim()) {
      alert("Zone name is required.");
      return;
    }

    let polyParsed = null;
    if (zoneFormData.polygon_json.trim()) {
      try {
        polyParsed = JSON.parse(zoneFormData.polygon_json);
      } catch {
        alert("Invalid Polygon Coordinates JSON format.");
        return;
      }
    }

    let exclParsed = null;
    if (zoneFormData.exclusion_json.trim()) {
      try {
        exclParsed = JSON.parse(zoneFormData.exclusion_json);
      } catch {
        alert("Invalid Exclusion Polygons JSON format.");
        return;
      }
    }

    try {
      const payload: any = {
        name: zoneFormData.name,
        pincode: zoneFormData.pincode,
        delivery_fee: Number(zoneFormData.delivery_fee),
        radius_km: Number(zoneFormData.radius_km),
        is_serviceable: zoneFormData.is_serviceable,
        reason: zoneFormData.reason || (editingZoneId ? "Updated zone parameters" : "Created zone"),
      };
      if (polyParsed) payload.polygon_coordinates = polyParsed;
      if (exclParsed) payload.exclusion_polygons = exclParsed;

      let res;
      if (editingZoneId) {
        res = await fetch(`/api/v1/admin/delivery-coverage/zones/${editingZoneId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, branch_id: selectedStoreForZones.id }),
        }).then((r) => r.json());
      } else {
        res = await fetch(`/api/v1/admin/delivery-coverage/stores/${selectedStoreForZones.id}/zones`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json());
      }

      if (res.success) {
        setSuccessMsg(`Zone "${zoneFormData.name}" successfully saved.`);
        setIsZoneModalOpen(false);
        setEditingZoneId(null);
        await loadStoreZones(selectedStoreForZones);
        await fetchData();
      } else {
        alert(res.error || "Failed to save zone.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save zone.");
    }
  };

  // Deactivate Zone
  const handleDeactivateZone = async (zoneId: string, zoneName: string) => {
    if (!confirm(`Are you sure you want to deactivate zone "${zoneName}"?`)) return;
    try {
      const res = await fetch(`/api/v1/admin/delivery-coverage/zones/${zoneId}`, {
        method: "DELETE",
      }).then((r) => r.json());

      if (res.success) {
        setSuccessMsg(`Zone "${zoneName}" deactivated.`);
        if (selectedStoreForZones) await loadStoreZones(selectedStoreForZones);
        await fetchData();
      } else {
        alert(res.error || "Failed to deactivate zone.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to deactivate zone.");
    }
  };

  // Save Partner Profile
  const handleSavePartnerProfile = async () => {
    if (!selectedPartnerForEdit) return;
    try {
      const res = await fetch(`/api/v1/admin/delivery-coverage/partners/${selectedPartnerForEdit.partner_id}/profile`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_type: partnerFormData.partner_type,
          status: partnerFormData.status,
          max_concurrent_orders: Number(partnerFormData.max_concurrent_orders),
          primary_branch_id: partnerFormData.primary_branch_id || null,
          metadata: { supports_cold_chain: partnerFormData.supports_cold_chain },
          reason: partnerFormData.reason || "Updated operational profile",
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSuccessMsg(`Partner "${selectedPartnerForEdit.partner_name}" profile updated.`);
        setSelectedPartnerForEdit(null);
        await fetchData();
      } else {
        alert(res.error || "Failed to update partner profile.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to update partner profile.");
    }
  };

  // Save Partner Coverage
  const handleSavePartnerCoverage = async () => {
    if (!selectedPartnerForCoverage) return;
    if (!partnerCoverageFormData.branch_id) {
      alert("Store Hub selection is required for coverage fence.");
      return;
    }

    let polyParsed = null;
    if (partnerCoverageFormData.polygon_json.trim()) {
      try {
        polyParsed = JSON.parse(partnerCoverageFormData.polygon_json);
      } catch {
        alert("Invalid Polygon Coordinates JSON format.");
        return;
      }
    }

    try {
      const res = await fetch(`/api/v1/admin/delivery-coverage/partners/${selectedPartnerForCoverage.partner_id}/coverage`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          branch_id: partnerCoverageFormData.branch_id,
          fence_type: partnerCoverageFormData.fence_type,
          radius_km: Number(partnerCoverageFormData.radius_km),
          polygon_coordinates: polyParsed,
          is_active: partnerCoverageFormData.is_active,
          reason: partnerCoverageFormData.reason || "Configured partner geofence boundary",
        }),
      }).then((r) => r.json());

      if (res.success) {
        setSuccessMsg("Partner coverage boundary saved successfully.");
        await loadPartnerCoverage(selectedPartnerForCoverage);
        await fetchData();
      } else {
        alert(res.error || "Failed to save partner coverage.");
      }
    } catch (err: any) {
      alert(err.message || "Failed to save partner coverage.");
    }
  };

  // Run Diagnostic Probe & Fail-Closed Corporate Resolver
  const handleRunDiagnostic = async () => {
    const lat = parseFloat(probeLat);
    const lng = parseFloat(probeLng);
    if (isNaN(lat) || isNaN(lng)) {
      alert("Please provide valid decimal coordinates for latitude and longitude.");
      return;
    }

    setProbeRunning(true);
    setProbeResult(null);
    setCorporateResolution(null);

    try {
      const payload: any = { latitude: lat, longitude: lng };
      if (probeStoreId) payload.branch_id = probeStoreId;

      const [valRes, corpRes] = await Promise.all([
        fetch("/api/v1/admin/delivery-coverage/validate-point", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json()),
        fetch("/api/v1/admin/delivery-coverage/resolve-corporate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then((r) => r.json()),
      ]);

      if (valRes.success) setProbeResult(valRes.result);
      if (corpRes.success) setCorporateResolution(corpRes.resolution);
    } catch (err: any) {
      alert(err.message || "Diagnostic probe evaluation failed.");
    } finally {
      setProbeRunning(false);
    }
  };

  // Filtered Lists
  const filteredStores = useMemo(() => {
    return stores.filter((s) => {
      const q = storeSearch.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        (s.city_name && s.city_name.toLowerCase().includes(q))
      );
    });
  }, [stores, storeSearch]);

  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const q = partnerSearch.toLowerCase();
      return (
        p.partner_name.toLowerCase().includes(q) ||
        p.partner_type.toLowerCase().includes(q) ||
        (p.primary_branch_name && p.primary_branch_name.toLowerCase().includes(q))
      );
    });
  }, [partners, partnerSearch]);

  const filteredAuditEvents = useMemo(() => {
    if (auditFilter === "ALL") return auditEvents;
    return auditEvents.filter((ev) => ev.entity_type === auditFilter);
  }, [auditEvents, auditFilter]);

  // Metrics
  const eligibleCount = stores.filter((s) => s.is_corporate_routing_eligible).length;
  const activePartnerCount = partners.filter((p) => p.status === "ACTIVE").length;
  const totalZonesCount = stores.reduce((acc, s) => acc + s.zones_count, 0);

  return (
    <div className="w-full space-y-6" id="delivery-coverage-panel-root">
      {/* Top Header & Metrics Bar */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-brand-navy to-slate-900 border border-brand-navy/40 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-brand-primary/10 blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-brand-primary/30 text-brand-primary border border-brand-primary/30">
                <Compass className="w-6 h-6" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-2">
                  Delivery Coverage & Map-Fenced Routing
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-brand-primary/20 text-brand-primary/30 border border-brand-primary/30">
                    Phase C7.10
                  </span>
                </h1>
                <p className="text-xs md:text-sm text-slate-300">
                  Governance engine for store boundary polygons, exclusion perimeters, delivery fleet geofences, and fail-closed corporate eligibility.
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 shadow-sm transition-all"
            id="refresh-coverage-data-btn"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-brand-primary" : ""}`} />
            Sync Network
          </button>
        </div>

        {/* Metric Counter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Network Stores</span>
            <div className="text-2xl font-black text-white mt-1">{stores.length}</div>
            <span className="text-[11px] text-slate-400">53 historical kitchen hubs</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Corporate Eligible</span>
            <div className="text-2xl font-black text-emerald-400 mt-1">{eligibleCount}</div>
            <span className="text-[11px] text-slate-400">Strict Allow-List Verified</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-brand-primary uppercase tracking-wider block">Active Fleet</span>
            <div className="text-2xl font-black text-brand-primary/30 mt-1">{activePartnerCount} / {partners.length}</div>
            <span className="text-[11px] text-slate-400">30 Preserved Partners</span>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-700/40 backdrop-blur-sm">
            <span className="text-[11px] font-bold text-brand-gold uppercase tracking-wider block">Store Zones</span>
            <div className="text-2xl font-black text-brand-gold/40 mt-1">{totalZonesCount}</div>
            <span className="text-[11px] text-slate-400">Polygons & Exclusions</span>
          </div>
        </div>
      </div>

      {/* Notifications Banner */}
      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-600 hover:text-emerald-800 font-bold">×</button>
        </div>
      )}
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-200 text-xs font-semibold flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-600 hover:text-rose-800 font-bold">×</button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("stores")}
          id="tab-btn-stores"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "stores"
              ? "bg-brand-navy text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Store Geofences & Allow-List
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{stores.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("partners")}
          id="tab-btn-partners"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "partners"
              ? "bg-brand-navy text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Delivery Fleet Geofences
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{partners.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("probe")}
          id="tab-btn-probe"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "probe"
              ? "bg-brand-navy text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Diagnostic Point Probe
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          id="tab-btn-audit"
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === "audit"
              ? "bg-brand-navy text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Lock className="w-3.5 h-3.5" />
          Audit Log
          <span className="px-1.5 py-0.2 rounded-md bg-white/20 text-[10px]">{auditEvents.length}</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: STORES GEOFENCE & ALLOW-LIST GOVERNANCE                             */}
      {/* ========================================================================= */}
      {activeTab === "stores" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by store name, code, city..."
                value={storeSearch}
                onChange={(e) => setStoreSearch(e.target.value)}
                id="search-store-input"
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <Info className="w-3.5 h-3.5 text-brand-primary" />
              <span>Allow-list defaults to false (D2 Option A). Verified hubs require explicit Super Admin audit approval.</span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" id="stores-coverage-table">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Kitchen Hub</th>
                    <th className="py-3 px-3">City / Coords</th>
                    <th className="py-3 px-3">Store Status</th>
                    <th className="py-3 px-3">Corporate Routing Allow-List</th>
                    <th className="py-3 px-3">Map Fences</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredStores.map((store) => (
                    <tr key={store.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{store.name}</div>
                        <div className="text-[11px] font-mono text-slate-500">{store.code}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200">{store.city_name || "—"}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          {store.latitude !== 999.999 ? `${store.latitude.toFixed(4)}, ${store.longitude.toFixed(4)}` : "⚠️ Missing Coords (999.999)"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          store.is_open ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        }`}>
                          {store.is_open ? "Open" : "Closed"}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setEligibilityModalStore(store);
                            setEligibilityReason("");
                          }}
                          id={`toggle-eligibility-${store.id}`}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all ${
                            store.is_corporate_routing_eligible
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 hover:bg-emerald-100"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {store.is_corporate_routing_eligible ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Verified Eligible</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Inactive (Default)</span>
                            </>
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                            {store.zones_count} Zones
                          </span>
                          {store.polygon_zones_count > 0 && (
                            <span className="px-1.5 py-0.5 rounded-md bg-brand-light dark:bg-brand-navy text-brand-navy dark:text-brand-primary/30 text-[10px] font-bold" title="Custom Polygon Boundaries">
                              Polygon
                            </span>
                          )}
                          {store.has_exclusions && (
                            <span className="px-1.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold" title="Restricted Exclusion Perimeter Configured">
                              Exclusion
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => loadStoreZones(store)}
                          id={`manage-zones-btn-${store.id}`}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition-all"
                        >
                          Configure Fences
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DELIVERY FLEET GEOFENCES                                           */}
      {/* ========================================================================= */}
      {activeTab === "partners" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search delivery partner..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                id="search-partner-input"
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <Info className="w-3.5 h-3.5 text-brand-primary" />
              <span>30 partner records preserved (D1 Option A). Operational geofence configured in delivery_partner_coverage.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5" id="partners-grid">
            {filteredPartners.map((partner) => (
              <div
                key={partner.partner_id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">{partner.partner_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      partner.status === "ACTIVE"
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}>
                      {partner.status}
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400 mt-0.5">{partner.partner_id}</div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Fleet Type:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{partner.partner_type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Hub:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-200 truncate max-w-[160px]">
                        {partner.primary_branch_name || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Capacity:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{partner.max_concurrent_orders} concurrent</span>
                    </div>
                    {partner.metadata?.supports_cold_chain && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-brand-primary dark:text-brand-primary mt-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Supports Cold Chain Packaging</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    onClick={() => {
                      setSelectedPartnerForEdit(partner);
                      setPartnerFormData({
                        partner_type: partner.partner_type,
                        status: partner.status,
                        max_concurrent_orders: partner.max_concurrent_orders,
                        primary_branch_id: partner.primary_branch_id || "",
                        supports_cold_chain: Boolean(partner.metadata?.supports_cold_chain),
                        reason: "",
                      });
                    }}
                    id={`edit-partner-profile-${partner.partner_id}`}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all text-center"
                  >
                    Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      loadPartnerCoverage(partner);
                      setPartnerCoverageFormData({
                        fence_type: "POLYGON",
                        branch_id: partner.primary_branch_id || (stores[0]?.id || ""),
                        radius_km: 10,
                        polygon_json: "",
                        is_active: true,
                        reason: "",
                      });
                    }}
                    id={`manage-partner-coverage-${partner.partner_id}`}
                    className="flex-1 py-1.5 px-2.5 rounded-xl bg-brand-light dark:bg-brand-navy/40 hover:bg-brand-light dark:hover:bg-brand-navy/40 text-brand-navy dark:text-brand-primary/30 border border-brand-primary/30 dark:border-brand-navy/60 text-xs font-bold transition-all text-center"
                  >
                    Geofences
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DIAGNOSTIC POINT PROBE & FAIL-CLOSED RESOLVER                      */}
      {/* ========================================================================= */}
      {activeTab === "probe" && (
        <div className="space-y-6" id="diagnostic-probe-tab">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Navigation className="w-4 h-4 text-brand-primary" />
                Live Spatial Engine & Fail-Closed Corporate Routing Simulator
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Authoritative testing probe evaluating TypeScript point-in-polygon raycasting, spherical Haversine distance, and strict corporate routing safeguards.
              </p>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-400">Quick Test Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setProbeLat("12.9716");
                  setProbeLng("77.6412");
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                📍 Indiranagar Central Hub
              </button>
              <button
                type="button"
                onClick={() => {
                  setProbeLat("12.9352");
                  setProbeLng("77.6245");
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                📍 Koramangala Perimeter
              </button>
              <button
                type="button"
                onClick={() => {
                  setProbeLat("13.5000");
                  setProbeLng("78.5000");
                }}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200"
              >
                🚫 Remote Out of Bounds
              </button>
              <button
                type="button"
                onClick={() => {
                  setProbeLat("999.999");
                  setProbeLng("999.999");
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-[11px] font-medium text-rose-700 dark:text-rose-300 hover:bg-rose-100"
              >
                ⚠️ Sentinel Anomaly (999.999)
              </button>
            </div>

            {/* Form Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Latitude
                </label>
                <input
                  type="text"
                  value={probeLat}
                  onChange={(e) => setProbeLat(e.target.value)}
                  placeholder="e.g. 12.9716"
                  id="probe-latitude-input"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Longitude
                </label>
                <input
                  type="text"
                  value={probeLng}
                  onChange={(e) => setProbeLng(e.target.value)}
                  placeholder="e.g. 77.6412"
                  id="probe-longitude-input"
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Target Store Filter (Optional)
                </label>
                <select
                  value={probeStoreId}
                  onChange={(e) => setProbeStoreId(e.target.value)}
                  id="probe-store-select"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
                >
                  <option value="">Scan Entire 53-Hub Network</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleRunDiagnostic}
                disabled={probeRunning}
                id="run-probe-btn"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-navy hover:bg-[#162447] text-white text-xs font-bold shadow-md transition-all disabled:opacity-50"
              >
                {probeRunning ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Evaluating Spatial Geometry...
                  </>
                ) : (
                  <>
                    <Compass className="w-4 h-4" />
                    Execute Spatial & Fail-Closed Evaluation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Diagnostic Results Cards */}
          {(probeResult || corporateResolution) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="diagnostic-results-section">
              {/* Geometry Diagnostic Result */}
              {probeResult && (
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Spatial Geometry Match</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      probeResult.serviceable
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}>
                      {probeResult.serviceable ? "SERVICEABLE" : "UNSERVICEABLE"}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 text-xs">
                    <div className="font-bold text-slate-900 dark:text-white">Reason Code: {probeResult.reason_code}</div>
                    <p className="text-slate-600 dark:text-slate-400 mt-1">{probeResult.diagnostics_message}</p>
                  </div>

                  {probeResult.matched_store && (
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Matched Store:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{probeResult.matched_store.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Distance to Store:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{probeResult.matched_store.distance_km} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Matching Zone:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{probeResult.matched_store.zone_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Store Corporate Allow-List:</span>
                        <span className={`font-bold ${probeResult.matched_store.is_corporate_routing_eligible ? "text-emerald-600" : "text-rose-600"}`}>
                          {probeResult.matched_store.is_corporate_routing_eligible ? "ELIGIBLE" : "NOT VERIFIED"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    Evaluated {probeResult.evaluated_stores_count} stores, {probeResult.evaluated_zones_count} zones.
                  </div>
                </div>
              )}

              {/* Fail-Closed Corporate Routing Result */}
              {corporateResolution && (
                <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Corporate Routing Decision</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      corporateResolution.resolved
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                        : "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                    }`}>
                      {corporateResolution.resolved ? "ROUTING RESOLVED" : "FAILED CLOSED"}
                    </span>
                  </div>

                  <div className={`p-3 rounded-xl border text-xs ${
                    corporateResolution.resolved
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200"
                      : "bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800/40 text-rose-900 dark:text-rose-200"
                  }`}>
                    <div className="font-bold">Result: {corporateResolution.reason_code}</div>
                    <p className="mt-1">{corporateResolution.message}</p>
                  </div>

                  {corporateResolution.store && (
                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <div className="flex justify-between">
                        <span>Assigned Store Hub:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{corporateResolution.store.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned Partner:</span>
                        <span className="font-bold text-slate-900 dark:text-white">{corporateResolution.partner ? corporateResolution.partner.partner_name : "None Eligible"}</span>
                      </div>
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px] text-slate-500 flex items-center gap-1.5 mt-2">
                    <ShieldAlert className="w-3.5 h-3.5 text-brand-gold shrink-0" />
                    <span>D4 Safeguard: Never calls legacy B2C or locality fallbacks. Fails closed on any ambiguity.</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: IMMUTABLE COVERAGE AUDIT LOG                                       */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="space-y-4" id="audit-log-tab">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500">Filter Entity:</span>
              {["ALL", "STORE_ELIGIBILITY", "STORE_ZONE", "PARTNER_COVERAGE"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setAuditFilter(cat)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                    auditFilter === cat
                      ? "bg-brand-navy text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200"
                  }`}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-400 font-mono">
              🔒 Append-Only PostgreSQL Trigger Defense Active
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs" id="audit-events-table">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-3">Event Type</th>
                    <th className="py-3 px-3">Entity</th>
                    <th className="py-3 px-3">Actor</th>
                    <th className="py-3 px-3">Reason</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {filteredAuditEvents.map((ev) => (
                    <tr key={ev.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(ev.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-light dark:bg-brand-navy text-brand-navy dark:text-brand-primary/30">
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{ev.entity_type}</span>
                        <div className="text-[10px] font-mono text-slate-400">{ev.entity_id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-slate-800 dark:text-slate-200 font-bold">{ev.actor_id}</div>
                        <div className="text-[10px] text-slate-400">{ev.actor_role}</div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {ev.reason || "—"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => setSelectedAuditEvent(ev)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300"
                        >
                          View Diff
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredAuditEvents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No audit events recorded for the selected filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: STORE ELIGIBILITY ALLOW-LIST TOGGLE MODAL                        */}
      {/* ========================================================================= */}
      {eligibilityModalStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <span className={`p-2.5 rounded-xl ${
                eligibilityModalStore.is_corporate_routing_eligible ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
              }`}>
                <Shield className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {eligibilityModalStore.is_corporate_routing_eligible ? "Disable Corporate Routing" : "Authorize Corporate Routing"}
                </h3>
                <p className="text-xs text-slate-500">{eligibilityModalStore.name} ({eligibilityModalStore.code})</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-brand-gold-light dark:bg-brand-gold-dark/30 border border-brand-gold/40 dark:border-brand-gold-dark/40 text-xs text-brand-gold-dark dark:text-brand-gold/40">
              <span className="font-bold block mb-1">D2 Option A & Four-Eyes Governance Guard:</span>
              Enabling this store adds it to the corporate routing allow-list. Newly added stores must be explicitly verified and cannot be inferred from branch coordinates.
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Audit Reason <span className="text-rose-500">* (min 5 chars)</span>
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Verified kitchen capacity, cold-chain packaging readiness, and GPS accuracy."
                value={eligibilityReason}
                onChange={(e) => setEligibilityReason(e.target.value)}
                id="eligibility-reason-textarea"
                className="w-full p-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-navy"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEligibilityModalStore(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleToggleEligibility}
                disabled={submittingEligibility || eligibilityReason.trim().length < 5}
                id="confirm-eligibility-toggle-btn"
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-50 transition-all ${
                  eligibilityModalStore.is_corporate_routing_eligible ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"
                }`}
              >
                {submittingEligibility ? "Recording Audit Event..." : "Confirm & Record Immutable Event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: STORE ZONES MANAGEMENT DRAWER                                     */}
      {/* ========================================================================= */}
      {selectedStoreForZones && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-xs">
          <div className="w-full max-w-2xl h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 p-6 flex flex-col shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Map Fences & Boundaries — {selectedStoreForZones.name}
                </h3>
                <p className="text-xs text-slate-500">Hub ID: {selectedStoreForZones.id} • {storeZones.length} Zones</p>
              </div>
              <button
                onClick={() => setSelectedStoreForZones(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between py-4">
              <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Configured Serviceability Fences</span>
              <button
                onClick={() => {
                  setEditingZoneId(null);
                  setZoneFormData({
                    name: `${selectedStoreForZones.name} Express Zone`,
                    pincode: "560001",
                    delivery_fee: 50,
                    radius_km: 8.5,
                    polygon_json: JSON.stringify([
                      [selectedStoreForZones.latitude - 0.04, selectedStoreForZones.longitude - 0.04],
                      [selectedStoreForZones.latitude + 0.04, selectedStoreForZones.longitude - 0.04],
                      [selectedStoreForZones.latitude + 0.04, selectedStoreForZones.longitude + 0.04],
                      [selectedStoreForZones.latitude - 0.04, selectedStoreForZones.longitude + 0.04],
                    ], null, 2),
                    exclusion_json: "",
                    is_serviceable: true,
                    reason: "",
                  });
                  setIsZoneModalOpen(true);
                }}
                id="add-new-zone-btn"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-navy hover:bg-[#162447] text-white text-xs font-bold shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Delivery Zone
              </button>
            </div>

            {loadingZones ? (
              <div className="py-12 text-center text-xs text-slate-400">Loading store zones...</div>
            ) : storeZones.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                No delivery zones configured for this kitchen hub.
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto">
                {storeZones.map((zone) => (
                  <div key={zone.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 dark:text-white text-xs">{zone.name || "Standard Zone"}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        zone.is_serviceable ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                      }`}>
                        {zone.is_serviceable ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <div>Radius: <span className="font-bold text-slate-700 dark:text-slate-300">{zone.radius_km || "—"} km</span></div>
                      <div>Fee: <span className="font-bold text-slate-700 dark:text-slate-300">₹{zone.delivery_fee}</span></div>
                      <div>Pincode: <span className="font-bold text-slate-700 dark:text-slate-300">{zone.pincode}</span></div>
                      <div>Priority: <span className="font-bold text-slate-700 dark:text-slate-300">{zone.priority}</span></div>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      {zone.polygon_coordinates && (
                        <span className="px-2 py-0.5 rounded-md bg-brand-light dark:bg-brand-navy text-brand-navy dark:text-brand-primary/30 text-[10px] font-bold">
                          {zone.polygon_coordinates.length} Vertices Polygon
                        </span>
                      )}
                      {zone.exclusion_polygons && zone.exclusion_polygons.length > 0 && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 text-[10px] font-bold">
                          {zone.exclusion_polygons.length} Exclusion Zones
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                      <button
                        onClick={() => {
                          setEditingZoneId(zone.id);
                          setZoneFormData({
                            name: zone.name || "",
                            pincode: zone.pincode || "560001",
                            delivery_fee: zone.delivery_fee || 50,
                            radius_km: zone.radius_km || 8.5,
                            polygon_json: zone.polygon_coordinates ? JSON.stringify(zone.polygon_coordinates, null, 2) : "",
                            exclusion_json: zone.exclusion_polygons ? JSON.stringify(zone.exclusion_polygons, null, 2) : "",
                            is_serviceable: zone.is_serviceable,
                            reason: "",
                          });
                          setIsZoneModalOpen(true);
                        }}
                        className="p-1 text-slate-500 hover:text-brand-primary"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeactivateZone(zone.id, zone.name || "Zone")}
                        className="p-1 text-slate-500 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ZONE CREATE / EDIT MODAL                                         */}
      {/* ========================================================================= */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {editingZoneId ? "Edit Delivery Zone" : "Configure New Delivery Zone"}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Zone Name *</label>
                <input
                  type="text"
                  value={zoneFormData.name}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Radius Ceiling (km)</label>
                  <input
                    type="number"
                    step="0.5"
                    max="25.0"
                    value={zoneFormData.radius_km}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, radius_km: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Delivery Fee (₹)</label>
                  <input
                    type="number"
                    value={zoneFormData.delivery_fee}
                    onChange={(e) => setZoneFormData({ ...zoneFormData, delivery_fee: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Polygon Coordinates (JSON Array of [lat, lng])
                </label>
                <textarea
                  rows={4}
                  value={zoneFormData.polygon_json}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, polygon_json: e.target.value })}
                  placeholder={`[ [12.92, 77.58], [12.98, 77.58], [12.98, 77.65], [12.92, 77.65] ]`}
                  className="w-full p-2.5 font-mono text-[11px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Exclusion Polygons (Optional JSON Array of Arrays)
                </label>
                <textarea
                  rows={3}
                  value={zoneFormData.exclusion_json}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, exclusion_json: e.target.value })}
                  placeholder={`[ [ [12.93, 77.60], [12.94, 77.60], [12.94, 77.61], [12.93, 77.61] ] ]`}
                  className="w-full p-2.5 font-mono text-[11px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={zoneFormData.reason}
                  onChange={(e) => setZoneFormData({ ...zoneFormData, reason: e.target.value })}
                  placeholder="e.g. Configured expanded radius and defence boundary"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsZoneModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveZone}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-[#162447] shadow-sm"
              >
                Save Zone & Record Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: PARTNER PROFILE EDIT MODAL                                       */}
      {/* ========================================================================= */}
      {selectedPartnerForEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Edit Operational Profile — {selectedPartnerForEdit.partner_name}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Partner Type</label>
                <select
                  value={partnerFormData.partner_type}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, partner_type: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="OWN_FLEET">OWN_FLEET (In-House Drivers)</option>
                  <option value="COURIER">COURIER (Dedicated Express)</option>
                  <option value="3PL_AGGREGATOR">3PL_AGGREGATOR (Third-Party Logistics)</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Status</label>
                <select
                  value={partnerFormData.status}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, status: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Max Concurrent Orders (1..50)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={partnerFormData.max_concurrent_orders}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, max_concurrent_orders: parseInt(e.target.value, 10) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Primary Store Hub</label>
                <select
                  value={partnerFormData.primary_branch_id}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, primary_branch_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                >
                  <option value="">None (Network-Wide / Unassigned)</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="cold-chain-cb"
                  checked={partnerFormData.supports_cold_chain}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, supports_cold_chain: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-primary"
                />
                <label htmlFor="cold-chain-cb" className="font-bold text-slate-700 dark:text-slate-300">
                  Equipped with Cold-Chain Insulated Bags
                </label>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={partnerFormData.reason}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, reason: e.target.value })}
                  placeholder="e.g. Updated partner capacity and hub alignment"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPartnerForEdit(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePartnerProfile}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-[#162447] shadow-sm"
              >
                Save Partner Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: PARTNER GEOFENCE COVERAGE MODAL                                  */}
      {/* ========================================================================= */}
      {selectedPartnerForCoverage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Geofence Coverage — {selectedPartnerForCoverage.partner_name}
              </h3>
              <button onClick={() => setSelectedPartnerForCoverage(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {loadingPartnerCoverage ? (
              <div className="py-6 text-center text-xs text-slate-400">Loading active fences...</div>
            ) : partnerCoverageList.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Existing Geofence Fences ({partnerCoverageList.length}):</span>
                {partnerCoverageList.map((c) => (
                  <div key={c.id} className="flex justify-between text-slate-500 font-mono text-[11px]">
                    <span>Fence: {c.fence_type} ({c.radius_km || 10}km)</span>
                    <span className={c.is_active ? "text-emerald-500 font-bold" : "text-slate-400"}>
                      {c.is_active ? "ACTIVE" : "INACTIVE"}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
              <h4 className="font-bold text-slate-900 dark:text-white">Configure Geofence Perimeter</h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Fence Type</label>
                  <select
                    value={partnerCoverageFormData.fence_type}
                    onChange={(e) => setPartnerCoverageFormData({ ...partnerCoverageFormData, fence_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="POLYGON">POLYGON (Custom Boundary)</option>
                    <option value="RADIUS">RADIUS (Circular Distance)</option>
                    <option value="HYBRID">HYBRID (Polygon + Radius Constrained)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Store Hub *</label>
                  <select
                    value={partnerCoverageFormData.branch_id}
                    onChange={(e) => setPartnerCoverageFormData({ ...partnerCoverageFormData, branch_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                  >
                    <option value="">Select Associated Store Hub</option>
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Radius (km)</label>
                <input
                  type="number"
                  step="0.5"
                  max="25.0"
                  value={partnerCoverageFormData.radius_km}
                  onChange={(e) => setPartnerCoverageFormData({ ...partnerCoverageFormData, radius_km: parseFloat(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">
                  Polygon Coordinates (JSON Array of [lat, lng])
                </label>
                <textarea
                  rows={4}
                  value={partnerCoverageFormData.polygon_json}
                  onChange={(e) => setPartnerCoverageFormData({ ...partnerCoverageFormData, polygon_json: e.target.value })}
                  placeholder={`[ [12.91, 77.58], [12.98, 77.58], [12.98, 77.66], [12.91, 77.66] ]`}
                  className="w-full p-2.5 font-mono text-[11px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-600 dark:text-slate-400 mb-1">Audit Reason</label>
                <input
                  type="text"
                  value={partnerCoverageFormData.reason}
                  onChange={(e) => setPartnerCoverageFormData({ ...partnerCoverageFormData, reason: e.target.value })}
                  placeholder="e.g. Assigned metropolitan delivery corridor"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedPartnerForCoverage(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSavePartnerCoverage}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-brand-navy hover:bg-[#162447] shadow-sm"
              >
                Save Geofence
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: AUDIT EVENT DETAIL MODAL                                         */}
      {/* ========================================================================= */}
      {selectedAuditEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xl p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Audit Event Details</h3>
                <p className="text-xs font-mono text-slate-500">{selectedAuditEvent.id}</p>
              </div>
              <button onClick={() => setSelectedAuditEvent(null)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
              <div><span className="font-bold">Event Type:</span> {selectedAuditEvent.event_type}</div>
              <div><span className="font-bold">Entity:</span> {selectedAuditEvent.entity_type} ({selectedAuditEvent.entity_id})</div>
              <div><span className="font-bold">Actor:</span> {selectedAuditEvent.actor_id} ({selectedAuditEvent.actor_role})</div>
              <div><span className="font-bold">Timestamp:</span> {new Date(selectedAuditEvent.created_at).toISOString()}</div>
              <div><span className="font-bold">Reason:</span> {selectedAuditEvent.reason}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">Before State:</span>
                <pre className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[10px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditEvent.before_state, null, 2) || "null"}
                </pre>
              </div>
              <div>
                <span className="font-bold text-slate-600 dark:text-slate-400 block mb-1">After State:</span>
                <pre className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-950 font-mono text-[10px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedAuditEvent.after_state, null, 2) || "null"}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setSelectedAuditEvent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DeliveryCoveragePanel;
