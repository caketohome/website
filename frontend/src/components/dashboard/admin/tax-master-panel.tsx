"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Plus,
  Search,
  Edit,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Percent,
  FileText,
  Layers,
  Check,
  RefreshCw,
  Globe,
} from "lucide-react";
import { TaxConfigurationRecord, TaxRegionRecord, TaxMasterService } from "@frontend/lib/tax-master";

function parseStrictRateInput(
  raw: string,
  fieldLabel: string
): { ok: true; value: number } | { ok: false; error: string } {
  const trimmed = String(raw ?? "").trim();
  if (trimmed === "") {
    return { ok: false, error: `${fieldLabel} is required (enter 0 for 0%).` };
  }
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(trimmed)) {
    return { ok: false, error: `${fieldLabel} must be a valid number.` };
  }
  const num = Number(trimmed);
  if (!Number.isFinite(num) || Number.isNaN(num)) {
    return { ok: false, error: `${fieldLabel} must be a finite number.` };
  }
  if (num < 0) {
    return { ok: false, error: `${fieldLabel} cannot be negative.` };
  }
  if (num > 100) {
    return { ok: false, error: `${fieldLabel} cannot exceed 100%.` };
  }
  return { ok: true, value: Number(num.toFixed(4)) };
}

export function TaxMasterPanel() {
  const [configs, setConfigs] = useState<TaxConfigurationRecord[]>([]);
  const [regions, setRegions] = useState<TaxRegionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterActive, setFilterActive] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<TaxConfigurationRecord | null>(null);

  // Form states (rate inputs stored as strings so "0" is distinct from "")
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [regionId, setRegionId] = useState("txreg_in");
  const [taxability, setTaxability] = useState<"Taxable" | "Exempt" | "Nil Rated" | "Non-GST">("Taxable");
  const [gstRateInput, setGstRateInput] = useState<string>("5");
  const [cgstRateInput, setCgstRateInput] = useState<string>("2.5");
  const [sgstRateInput, setSgstRateInput] = useState<string>("2.5");
  const [igstRateInput, setIgstRateInput] = useState<string>("5");
  const [cessRateInput, setCessRateInput] = useState<string>("0");
  const [taxInclusive, setTaxInclusive] = useState<boolean>(true);
  const [applicableSupplyType, setApplicableSupplyType] = useState<"BOTH" | "INTRA-STATE" | "INTER-STATE">("BOTH");
  const [applicableCustomerType, setApplicableCustomerType] = useState<"BOTH" | "B2B" | "B2C">("BOTH");
  const [isActive, setIsActive] = useState<boolean>(true);
  const [effectiveFrom, setEffectiveFrom] = useState<string>("2026-04-01");
  const [effectiveTo, setEffectiveTo] = useState<string>("");

  const [validationError, setValidationError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fetchedConfigs, fetchedRegions] = await Promise.all([
        TaxMasterService.fetchTaxConfigurations(),
        TaxMasterService.fetchTaxRegions(),
      ]);
      setConfigs(fetchedConfigs);
      setRegions(fetchedRegions);
    } catch (err: any) {
      setError(err?.message || "Failed to load tax configurations from PostgreSQL.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle GST auto-split when total GST changes
  const handleGstRateChange = (rawVal: string) => {
    setGstRateInput(rawVal);
    const trimmed = rawVal.trim();
    if (trimmed === "" || !/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(trimmed)) {
      return;
    }
    const rate = Number(trimmed);
    if (!Number.isFinite(rate) || rate < 0) return;

    if (rate === 0) {
      setCgstRateInput("0");
      setSgstRateInput("0");
      setIgstRateInput("0");
      return;
    }

    const half = Number((rate / 2).toFixed(4));
    if (applicableSupplyType === "INTRA-STATE") {
      setCgstRateInput(String(half));
      setSgstRateInput(String(half));
      setIgstRateInput("0");
    } else if (applicableSupplyType === "INTER-STATE") {
      setCgstRateInput("0");
      setSgstRateInput("0");
      setIgstRateInput(String(rate));
    } else {
      setCgstRateInput(String(half));
      setSgstRateInput(String(half));
      setIgstRateInput(String(rate));
    }
  };

  const handleTaxabilityChange = (val: "Taxable" | "Exempt" | "Nil Rated" | "Non-GST") => {
    setTaxability(val);
    if (val !== "Taxable") {
      setGstRateInput("0");
      setCgstRateInput("0");
      setSgstRateInput("0");
      setIgstRateInput("0");
      setCessRateInput("0");
    } else if (Number(gstRateInput) === 0) {
      setGstRateInput("5");
      if (applicableSupplyType === "INTRA-STATE") {
        setCgstRateInput("2.5");
        setSgstRateInput("2.5");
        setIgstRateInput("0");
      } else if (applicableSupplyType === "INTER-STATE") {
        setCgstRateInput("0");
        setSgstRateInput("0");
        setIgstRateInput("5");
      } else {
        setCgstRateInput("2.5");
        setSgstRateInput("2.5");
        setIgstRateInput("5");
      }
    }
  };

  const handleSupplyTypeChange = (newSupplyType: "BOTH" | "INTRA-STATE" | "INTER-STATE") => {
    setApplicableSupplyType(newSupplyType);
    if (taxability !== "Taxable") return;
    const gst = Number(gstRateInput);
    if (!Number.isFinite(gst) || gst < 0) return;
    const half = Number((gst / 2).toFixed(4));
    if (newSupplyType === "INTRA-STATE") {
      setCgstRateInput(String(half));
      setSgstRateInput(String(half));
      setIgstRateInput("0");
    } else if (newSupplyType === "INTER-STATE") {
      setCgstRateInput("0");
      setSgstRateInput("0");
      setIgstRateInput(String(gst));
    } else {
      if (Number(cgstRateInput) === 0 && Number(sgstRateInput) === 0 && gst > 0) {
        setCgstRateInput(String(half));
        setSgstRateInput(String(half));
      }
      if (Number(igstRateInput) === 0 && gst > 0) {
        setIgstRateInput(String(gst));
      }
    }
  };

  const handleOpenCreate = () => {
    setEditingConfig(null);
    setName("");
    setCode("");
    setDescription("");
    const defaultRegion = regions.find((r) => r.country_code === "in" && !r.province_code)?.id || regions[0]?.id || "txreg_in";
    setRegionId(defaultRegion);
    setTaxability("Taxable");
    setGstRateInput("5");
    setCgstRateInput("2.5");
    setSgstRateInput("2.5");
    setIgstRateInput("5");
    setCessRateInput("0");
    setTaxInclusive(true);
    setApplicableSupplyType("BOTH");
    setApplicableCustomerType("BOTH");
    setIsActive(true);
    setEffectiveFrom(new Date().toISOString().split("T")[0]);
    setEffectiveTo("");
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cfg: TaxConfigurationRecord) => {
    setEditingConfig(cfg);
    setName(cfg.name);
    setCode(cfg.code);
    setDescription(cfg.description || "");
    setRegionId(cfg.regionId || "txreg_in");
    setTaxability(cfg.taxability);
    setGstRateInput(String(cfg.gstRatePct ?? 0));
    setCgstRateInput(String(cfg.cgstRatePct ?? 0));
    setSgstRateInput(String(cfg.sgstRatePct ?? 0));
    setIgstRateInput(String(cfg.igstRatePct ?? 0));
    setCessRateInput(String(cfg.cessRatePct ?? 0));
    setTaxInclusive(cfg.taxInclusive);
    setApplicableSupplyType(cfg.applicableSupplyType);
    setApplicableCustomerType(cfg.applicableCustomerType);
    setIsActive(cfg.isActive);
    setEffectiveFrom(cfg.effectiveFrom);
    setEffectiveTo(cfg.effectiveTo || "");
    setValidationError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setValidationError("Tax Configuration Name is required.");
      return;
    }
    const trimmedCode = code.trim().toUpperCase().replace(/\s+/g, "_");
    if (!trimmedCode) {
      setValidationError("Tax Configuration Code is required.");
      return;
    }
    if (!/^[A-Z0-9_-]{2,64}$/.test(trimmedCode)) {
      setValidationError("Tax Configuration Code must be 2–64 alphanumeric characters, underscores, or hyphens.");
      return;
    }

    const gstParsed = parseStrictRateInput(gstRateInput, "Total GST Rate (%)");
    if (!gstParsed.ok) {
      setValidationError(gstParsed.error);
      return;
    }
    const cgstParsed = parseStrictRateInput(cgstRateInput, "CGST Rate (%)");
    if (!cgstParsed.ok) {
      setValidationError(cgstParsed.error);
      return;
    }
    const sgstParsed = parseStrictRateInput(sgstRateInput, "SGST Rate (%)");
    if (!sgstParsed.ok) {
      setValidationError(sgstParsed.error);
      return;
    }
    const igstParsed = parseStrictRateInput(igstRateInput, "IGST Rate (%)");
    if (!igstParsed.ok) {
      setValidationError(igstParsed.error);
      return;
    }
    const cessParsed = parseStrictRateInput(cessRateInput, "CESS Rate (%)");
    if (!cessParsed.ok) {
      setValidationError(cessParsed.error);
      return;
    }

    const gstRatePct = gstParsed.value;
    const cgstRatePct = cgstParsed.value;
    const sgstRatePct = sgstParsed.value;
    const igstRatePct = igstParsed.value;
    const cessRatePct = cessParsed.value;

    // Statutory GST Component Validation
    if (taxability !== "Taxable") {
      if (gstRatePct !== 0 || cgstRatePct !== 0 || sgstRatePct !== 0 || igstRatePct !== 0 || cessRatePct !== 0) {
        setValidationError(`${taxability} configurations must have 0% for Total GST, CGST, SGST, IGST, and CESS.`);
        return;
      }
    } else {
      if (applicableSupplyType === "INTRA-STATE") {
        if (Math.abs(cgstRatePct + sgstRatePct - gstRatePct) > 0.01) {
          setValidationError(
            `For Intra-State supplies, CGST (${cgstRatePct}%) + SGST (${sgstRatePct}%) must equal Total GST (${gstRatePct}%).`
          );
          return;
        }
        if (Math.abs(igstRatePct) > 0.0001) {
          setValidationError(`For Intra-State Only supplies, IGST must be 0% (received ${igstRatePct}%).`);
          return;
        }
      } else if (applicableSupplyType === "INTER-STATE") {
        if (Math.abs(igstRatePct - gstRatePct) > 0.01) {
          setValidationError(`For Inter-State supplies, IGST (${igstRatePct}%) must equal Total GST (${gstRatePct}%).`);
          return;
        }
        if (Math.abs(cgstRatePct) > 0.0001 || Math.abs(sgstRatePct) > 0.0001) {
          setValidationError(`For Inter-State Only supplies, CGST and SGST must be 0%.`);
          return;
        }
      } else {
        const validIntraSplit =
          Math.abs(cgstRatePct + sgstRatePct - gstRatePct) <= 0.01 &&
          (Math.abs(igstRatePct - gstRatePct) <= 0.01 || Math.abs(igstRatePct) <= 0.0001);
        const validInterOnly =
          Math.abs(igstRatePct - gstRatePct) <= 0.01 &&
          Math.abs(cgstRatePct) <= 0.0001 &&
          Math.abs(sgstRatePct) <= 0.0001;
        if (!validIntraSplit && !validInterOnly) {
          setValidationError(
            `Invalid GST component breakdown: CGST (${cgstRatePct}%) + SGST (${sgstRatePct}%) or IGST (${igstRatePct}%) must equal Total GST (${gstRatePct}%).`
          );
          return;
        }
      }
    }

    if (!effectiveFrom.trim()) {
      setValidationError("Effective From date is required.");
      return;
    }
    if (effectiveTo.trim() && effectiveTo.trim() < effectiveFrom.trim()) {
      setValidationError(`Effective To date (${effectiveTo}) cannot be earlier than Effective From date (${effectiveFrom}).`);
      return;
    }

    setSaving(true);
    try {
      const result = await TaxMasterService.saveTaxConfiguration({
        id: editingConfig?.id,
        name: trimmedName,
        code: trimmedCode,
        description: description.trim() || `${gstRatePct}% GST (${taxability})`,
        regionId: regionId || "txreg_in",
        taxability,
        gstRatePct,
        cgstRatePct,
        sgstRatePct,
        igstRatePct,
        cessRatePct,
        taxInclusive,
        applicableSupplyType,
        applicableCustomerType,
        isActive,
        effectiveFrom: effectiveFrom.trim(),
        effectiveTo: effectiveTo.trim() || undefined,
      });
      if (!result.success) {
        setValidationError(result.error || "Failed to save tax configuration.");
        return;
      }
      await loadData();
      setIsModalOpen(false);
      setSuccessMessage(
        editingConfig
          ? `Updated Tax Configuration "${trimmedName}" (${trimmedCode}).`
          : `Created Reusable Tax Configuration "${trimmedName}" (${trimmedCode}).`
      );
    } catch (err: any) {
      setValidationError(err?.message || "Failed to save tax configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cfg: TaxConfigurationRecord) => {
    setError(null);
    setSuccessMessage(null);
    const nextState = !cfg.isActive;
    const res = await TaxMasterService.toggleActive(cfg.id, nextState);
    if (!res.success) {
      setError(res.error || "Failed to update active status.");
      return;
    }
    await loadData();
    setSuccessMessage(
      `Tax Configuration "${cfg.name}" (${cfg.code}) marked as ${nextState ? "Active" : "Inactive"}.`
    );
  };

  const filteredConfigs = configs.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter =
      filterActive === "ALL" ||
      (filterActive === "ACTIVE" && c.isActive) ||
      (filterActive === "INACTIVE" && !c.isActive);
    return matchesSearch && matchesFilter;
  });

  const getRegionLabel = (regId?: string) => {
    if (!regId) return "India (IN)";
    const found = regions.find((r) => r.id === regId);
    if (!found) return regId;
    if (found.metadata?.name) return found.metadata.name;
    return found.province_code
      ? `${found.country_code.toUpperCase()}-${found.province_code}`
      : `${found.country_code.toUpperCase()} (All-India)`;
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#2A1810] via-[#3D2317] to-[#2A1810] rounded-3xl p-6 text-white shadow-xl border border-[#C9973A]/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9973A]/20 border border-[#C9973A]/40 text-[#F3E5AB] text-[11px] font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9973A]" />
            Statutory GST Compliance Engine
          </div>
          <h2 className="text-2xl font-black tracking-tight">Tax Master & GST Rules</h2>
          <p className="text-xs text-stone-300 max-w-2xl leading-relaxed">
            Centralized, reusable GST tax configurations for all bakery products, accessories, party supplies, and corporate hampers. Products inherit tax rules directly from this master while retaining HSN/SAC codes at the item level.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/15 transition-all"
            title="Refresh from PostgreSQL"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#C9973A] hover:bg-[#b58630] text-[#1C110B] font-black text-xs uppercase tracking-wider shadow-lg transition-all"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Create Tax Configuration
          </button>
        </div>
      </div>

      {/* Explicit Error Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Explicit Success Banner */}
      {successMessage && (
        <div
          role="status"
          className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between gap-4 text-xs font-bold"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 text-[11px] font-black uppercase"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/60 flex items-center justify-center text-amber-700">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Configurations</div>
            <div className="text-xl font-black text-stone-900">{configs.length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Active Rules</div>
            <div className="text-xl font-black text-emerald-700">{configs.filter((c) => c.isActive).length}</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200/60 flex items-center justify-center text-blue-700">
            <Percent className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Standard Slabs</div>
            <div className="text-xl font-black text-stone-900">0%, 5%, 12%, 18%</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-200/60 flex items-center justify-center text-purple-700">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Mapped Products</div>
            <div className="text-xl font-black text-stone-900">
              {configs.reduce((acc, item) => acc + (item.usageCount || 0), 0)} Items
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl p-4 border border-stone-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by tax name, code (e.g. GST_FOOD_5), or description..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 focus:border-[#C9973A]"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {(["ALL", "ACTIVE", "INACTIVE"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setFilterActive(status)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                filterActive === status
                  ? "bg-[#2A1810] text-[#F3E5AB] shadow-sm"
                  : "bg-stone-100 text-stone-600 hover:bg-stone-200"
              }`}
            >
              {status === "ALL" ? "All Rules" : status === "ACTIVE" ? "Active Only" : "Inactive Only"}
            </button>
          ))}
        </div>
      </div>

      {/* Tax Configurations Table */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/80 text-[11px] font-bold uppercase tracking-wider text-stone-500">
                <th className="py-3.5 px-4">Tax Configuration</th>
                <th className="py-3.5 px-4">Code</th>
                <th className="py-3.5 px-4">Taxability</th>
                <th className="py-3.5 px-4">Total GST</th>
                <th className="py-3.5 px-4">Split (CGST / SGST / IGST / CESS)</th>
                <th className="py-3.5 px-4">Pricing Mode</th>
                <th className="py-3.5 px-4">Scope & Region</th>
                <th className="py-3.5 px-4 text-center">Products</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    Loading reusable tax configurations from PostgreSQL...
                  </td>
                </tr>
              ) : filteredConfigs.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    No tax configurations found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredConfigs.map((cfg) => (
                  <tr key={cfg.id} className="hover:bg-stone-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-stone-900">{cfg.name}</div>
                      {cfg.description && (
                        <div className="text-[11px] text-stone-500 line-clamp-1 mt-0.5">{cfg.description}</div>
                      )}
                      <div className="text-[10px] text-stone-400 mt-0.5">
                        Effective: {cfg.effectiveFrom} {cfg.effectiveTo ? `→ ${cfg.effectiveTo}` : "(Ongoing)"}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-1 rounded-lg bg-stone-100 border border-stone-200 font-mono text-[11px] font-bold text-stone-800">
                        {cfg.code}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          cfg.taxability === "Taxable"
                            ? "bg-amber-50 text-amber-800 border border-amber-200"
                            : "bg-stone-100 text-stone-700 border border-stone-200"
                        }`}
                      >
                        {cfg.taxability}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-sm font-black text-stone-900">{cfg.gstRatePct}%</span>
                      {cfg.cessRatePct > 0 && (
                        <span className="ml-1.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">
                          +{cfg.cessRatePct}% CESS
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-stone-600">
                      <span title="CGST">{cfg.cgstRatePct}%</span> /{" "}
                      <span title="SGST">{cfg.sgstRatePct}%</span> /{" "}
                      <span title="IGST">{cfg.igstRatePct}%</span>
                      <span className="text-stone-400"> (CESS: {cfg.cessRatePct || 0}%)</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                          cfg.taxInclusive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                            : "bg-blue-50 text-blue-700 border border-blue-200/60"
                        }`}
                      >
                        {cfg.taxInclusive ? "Tax Inclusive" : "Tax Exclusive"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-[11px] text-stone-600">
                      <div>Supply: <strong className="text-stone-800">{cfg.applicableSupplyType}</strong></div>
                      <div>Customer: <strong className="text-stone-800">{cfg.applicableCustomerType}</strong></div>
                      <div className="text-[10px] text-stone-400 flex items-center gap-1 mt-0.5">
                        <Globe className="w-3 h-3" />
                        {getRegionLabel(cfg.regionId)}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-[28px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-800 font-bold text-[11px]">
                        {cfg.usageCount || 0}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(cfg)}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                          cfg.isActive
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                            : "bg-stone-100 text-stone-500 border border-stone-200 hover:bg-stone-200"
                        }`}
                      >
                        {cfg.isActive ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5 text-stone-400" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(cfg)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold text-xs transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/60">
              <div>
                <h3 className="text-lg font-black text-stone-900">
                  {editingConfig ? "Edit Tax Master Configuration" : "Create Reusable Tax Master Configuration"}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Configure statutory GST slabs and component splits for product assignment.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5" noValidate>
              {validationError && (
                <div
                  role="alert"
                  data-testid="tax-modal-validation-error"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{validationError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Tax Configuration Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. GST 18% - Bakery Accessories"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 focus:border-[#C9973A]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Tax Configuration Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, "_"))}
                    placeholder="e.g. GST_ACCESSORY_18"
                    className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 focus:border-[#C9973A]"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Description
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe which product categories or statutory rules use this tax configuration..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#C9973A]/30 focus:border-[#C9973A]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Tax Region / Jurisdiction *
                  </label>
                  <select
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white font-semibold"
                  >
                    {regions.length === 0 ? (
                      <option value="txreg_in">India (All-India GST Jurisdiction)</option>
                    ) : (
                      regions.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.metadata?.name ||
                            (r.province_code
                              ? `${r.country_code.toUpperCase()} - State ${r.province_code}`
                              : `${r.country_code.toUpperCase()} (All-India)`)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Taxability *
                  </label>
                  <select
                    value={taxability}
                    onChange={(e) => handleTaxabilityChange(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white font-semibold"
                  >
                    <option value="Taxable">Taxable</option>
                    <option value="Exempt">Exempt (0%)</option>
                    <option value="Nil Rated">Nil Rated (0%)</option>
                    <option value="Non-GST">Non-GST (0%)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Total GST Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={gstRateInput}
                    disabled={taxability !== "Taxable"}
                    onChange={(e) => handleGstRateChange(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border border-stone-200 disabled:bg-stone-100"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    CESS Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={cessRateInput}
                    disabled={taxability !== "Taxable"}
                    onChange={(e) => setCessRateInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 disabled:bg-stone-100"
                  />
                </div>
              </div>

              {/* Component Breakdown */}
              <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    CGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={cgstRateInput}
                    disabled={taxability !== "Taxable"}
                    onChange={(e) => setCgstRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 bg-white disabled:bg-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    SGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={sgstRateInput}
                    disabled={taxability !== "Taxable"}
                    onChange={(e) => setSgstRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 bg-white disabled:bg-stone-100"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    IGST Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={igstRateInput}
                    disabled={taxability !== "Taxable"}
                    onChange={(e) => setIgstRateInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-200 bg-white disabled:bg-stone-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Applicable Supply Type
                  </label>
                  <select
                    value={applicableSupplyType}
                    onChange={(e) => handleSupplyTypeChange(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="BOTH">Both (Intra-State & Inter-State)</option>
                    <option value="INTRA-STATE">Intra-State Only</option>
                    <option value="INTER-STATE">Inter-State Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Applicable Customer Type
                  </label>
                  <select
                    value={applicableCustomerType}
                    onChange={(e) => setApplicableCustomerType(e.target.value as any)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200 bg-white"
                  >
                    <option value="BOTH">Both (B2B & B2C)</option>
                    <option value="B2C">B2C Retail Only</option>
                    <option value="B2B">B2B Corporate (GSTIN) Only</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    value={effectiveFrom}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-600 mb-1.5">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={effectiveTo}
                    onChange={(e) => setEffectiveTo(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-stone-200"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-2 border-t border-stone-100">
                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taxInclusive}
                    onChange={(e) => setTaxInclusive(e.target.checked)}
                    className="w-4 h-4 rounded text-[#C9973A] focus:ring-[#C9973A]"
                  />
                  <span className="text-xs font-semibold text-stone-800">
                    Default Tax-Inclusive Catalog Pricing
                  </span>
                </label>

                <label className="inline-flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs font-semibold text-stone-800">Configuration Active</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-stone-200 text-stone-600 font-bold text-xs hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2A1810] hover:bg-[#3D2317] text-[#F3E5AB] font-black text-xs uppercase tracking-wider shadow-md transition-all disabled:opacity-60"
                >
                  <Check className="w-4 h-4" />
                  {saving ? "Saving..." : editingConfig ? "Update Configuration" : "Save Configuration"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
