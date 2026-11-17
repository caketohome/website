"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input, Switch, Label } from "@medusajs/ui";
import {
  Clock,
  Calendar,
  Zap,
  Timer,
  Plus,
  Save,
  Trash2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Sliders,
  ShieldCheck,
  Store,
} from "lucide-react";
import {
  DAY_NAMES,
  DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
  DEFAULT_LATE_NIGHT_CONFIG,
  DEFAULT_EXPRESS_CONFIG,
} from "@frontend/lib/fulfillment/types";
import type {
  GlobalFulfillmentConfig,
  OperatingHoursEntry,
  HolidayEntry,
  LateNightDeliveryConfig,
  ExpressDeliveryConfig,
} from "@frontend/lib/fulfillment/types";
import { Moon } from "lucide-react";

export const FulfillmentConfigPanel = memo(function FulfillmentConfigPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Configuration State
  const [config, setConfig] = useState<GlobalFulfillmentConfig>({
    ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
    business_timezone: "Asia/Kolkata",
    global_order_cutoff_time: "18:00",
    global_instant_delivery_enabled: true,
    global_same_day_delivery_enabled: true,
    default_preparation_time_minutes: 60,
    default_delivery_buffer_minutes: 30,
    global_preparation_delay_enabled: false,
    global_preparation_delay_minutes: 0,
    preparation_delay_reason: null,
    earliest_delivery_time: "09:00",
    latest_delivery_slot_start: "21:00",
    latest_delivery_slot_end: "22:00",
    late_night_delivery: { ...DEFAULT_LATE_NIGHT_CONFIG },
    express_delivery: { ...DEFAULT_EXPRESS_CONFIG },
  });

  const [operatingHours, setOperatingHours] = useState<OperatingHoursEntry[]>([]);
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayIsFullDay, setNewHolidayIsFullDay] = useState(true);

  // Live Simulator State
  const [simBranchId, setSimBranchId] = useState("br_default");
  const [simDate, setSimDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [simMode, setSimMode] = useState<"delivery" | "pickup">("delivery");
  const [simDeliveryMode, setSimDeliveryMode] = useState<"all" | "standard" | "express">("all");
  const [simBranches, setSimBranches] = useState<Array<{ id: string; name: string }>>([
    { id: "br_default", name: "Flagship Kitchen (Kollam Main Hub)" },
    { id: "br_kadavanthra", name: "Kochi Central Studio" },
    { id: "br_palayam", name: "Trivandrum City Kitchen" },
  ]);
  const [simSlots, setSimSlots] = useState<any[]>([]);
  const [loadingSim, setLoadingSim] = useState(false);

  const fetchSimSlots = async () => {
    try {
      setLoadingSim(true);
      const params = new URLSearchParams({
        branch_id: simBranchId,
        date: simDate,
        mode: simMode,
        delivery_mode: simDeliveryMode,
      });
      const res = await fetch(`/api/v1/fulfillment/preview-slots?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSimSlots(data.delivery_slots || []);
      }
    } catch (e) {
      console.error("Failed to load simulator slots", e);
    } finally {
      setLoadingSim(false);
    }
  };

  useEffect(() => {
    fetchSimSlots();
  }, [simBranchId, simDate, simMode, simDeliveryMode, config]);

  const fetchFulfillmentConfig = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/fulfillment/config");
      if (!res.ok) throw new Error("Failed to load fulfillment config");
      const data = await res.json();
      if (data.config) {
        setConfig({
          ...DEFAULT_GLOBAL_FULFILLMENT_CONFIG,
          ...data.config,
          late_night_delivery: {
            ...DEFAULT_LATE_NIGHT_CONFIG,
            ...(data.config.late_night_delivery || {}),
          },
          express_delivery: {
            ...DEFAULT_EXPRESS_CONFIG,
            ...(data.config.express_delivery || {}),
          },
        });
      }
      if (data.operating_hours) setOperatingHours(data.operating_hours);
      if (data.holidays) setHolidays(data.holidays);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch fulfillment configuration");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillmentConfig();
  }, []);

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setSuccessMsg(null);
      setErrorMsg(null);

      const res = await fetch("/api/v1/fulfillment/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });

      if (!res.ok) throw new Error("Failed to save fulfillment configuration");

      setSuccessMsg("Fulfillment configuration updated successfully.");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateHours = async (dayOfWeek: number, field: keyof OperatingHoursEntry, value: any) => {
    const updated = operatingHours.map((h) =>
      h.day_of_week === dayOfWeek ? { ...h, [field]: value } : h
    );
    setOperatingHours(updated);

    const target = updated.find((h) => h.day_of_week === dayOfWeek);
    if (!target) return;

    try {
      await fetch("/api/v1/fulfillment/operating-hours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
    } catch (e) {
      console.error("Failed to update operating hours", e);
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName) return;

    try {
      const payload = {
        date: newHolidayDate,
        name: newHolidayName,
        is_full_day: newHolidayIsFullDay,
        entity_type: "organization",
        entity_id: "global",
      };

      const res = await fetch("/api/v1/fulfillment/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to add holiday");
      const data = await res.json();

      setHolidays((prev) => [...prev.filter((h) => h.date !== newHolidayDate), data.holiday]);
      setNewHolidayDate("");
      setNewHolidayName("");
      setSuccessMsg(`Holiday "${newHolidayName}" added.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to add holiday");
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center gap-3 text-slate-500">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-semibold">Loading fulfillment configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Clock className="w-6 h-6 text-rose-400" />
            <Heading level="h2" className="text-xl font-bold text-white">
              Order Cut-Off, Preparation & Fulfillment Engine
            </Heading>
            <Badge color="green" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              Active Cascade
            </Badge>
          </div>
          <Text className="text-xs text-slate-300">
            Authoritative operating hours, cutoff times, preparation delays, and holiday schedule across all bakeries.
          </Text>
        </div>

        <Button
          onClick={handleSaveConfig}
          isLoading={saving}
          className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition flex items-center gap-2 shrink-0"
        >
          <Save className="w-4 h-4" />
          Save Global Config
        </Button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center gap-2 p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Grid: Global Settings & Preparation Delay */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Global Cut-off & Delivery Settings */}
        <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Zap className="w-5 h-5 text-rose-600" />
            <h3 className="font-extrabold text-sm text-slate-900">Global Delivery & Cut-off Times</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Same-Day Delivery</span>
                <span className="text-[11px] text-slate-500">Allow customers to order cakes for same-day delivery</span>
              </div>
              <Switch
                checked={config.global_same_day_delivery_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, global_same_day_delivery_enabled: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Instant 2-Hour Delivery</span>
                <span className="text-[11px] text-slate-500">Enable express dispatch slots when kitchen volume permits</span>
              </div>
              <Switch
                checked={config.global_instant_delivery_enabled}
                onCheckedChange={(checked) => setConfig({ ...config, global_instant_delivery_enabled: checked })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Corporate Same-Day Acceptance Cut-off</Label>
                <Input
                  type="time"
                  value={config.global_order_cutoff_time}
                  onChange={(e) => setConfig({ ...config, global_order_cutoff_time: e.target.value })}
                  className="text-xs font-semibold rounded-xl"
                />
                <span className="text-[10px] text-slate-500 leading-tight block">
                  Final daily deadline for Head Office / Operations to accept and coordinate new same-day orders.
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Business Timezone</Label>
                <Input
                  type="text"
                  value={config.business_timezone}
                  onChange={(e) => setConfig({ ...config, business_timezone: e.target.value })}
                  className="text-xs font-semibold rounded-xl"
                />
                <span className="text-[10px] text-slate-400">Canonical operational timezone</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Default Baking Time (mins)</Label>
                <Input
                  type="number"
                  value={config.default_preparation_time_minutes}
                  onChange={(e) => setConfig({ ...config, default_preparation_time_minutes: Number(e.target.value) || 60 })}
                  className="text-xs font-semibold rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Delivery Buffer (mins)</Label>
                <Input
                  type="number"
                  value={config.default_delivery_buffer_minutes}
                  onChange={(e) => setConfig({ ...config, default_delivery_buffer_minutes: Number(e.target.value) || 30 })}
                  className="text-xs font-semibold rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Slot Duration (mins)</Label>
                <Input
                  type="number"
                  value={config.slot_duration_minutes || 60}
                  onChange={(e) => setConfig({ ...config, slot_duration_minutes: Number(e.target.value) || 60 })}
                  className="text-xs font-semibold rounded-xl"
                  placeholder="60"
                />
                <span className="text-[10px] text-slate-400">Duration of each delivery window (e.g. 60m = 1-hr slot, 30m = 30-min slot)</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Slot Interval (mins)</Label>
                <Input
                  type="number"
                  value={config.slot_interval_minutes || 60}
                  onChange={(e) => setConfig({ ...config, slot_interval_minutes: Number(e.target.value) || 60 })}
                  className="text-xs font-semibold rounded-xl"
                  placeholder="60"
                />
                <span className="text-[10px] text-slate-400">Step interval between start times (e.g. 60m, 30m, 15m)</span>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Max Capacity / Slot</Label>
                <Input
                  type="number"
                  value={config.max_slots_per_window || 10}
                  onChange={(e) => setConfig({ ...config, max_slots_per_window: Number(e.target.value) || 10 })}
                  className="text-xs font-semibold rounded-xl"
                  placeholder="10"
                />
                <span className="text-[10px] text-slate-400">Concurrent orders permitted per window</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Earliest Delivery Slot</Label>
                <Input
                  type="time"
                  value={config.earliest_delivery_time || "09:00"}
                  onChange={(e) => setConfig({ ...config, earliest_delivery_time: e.target.value })}
                  className="text-xs font-semibold rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Latest Slot Start</Label>
                <Input
                  type="time"
                  value={config.latest_delivery_slot_start || "21:00"}
                  onChange={(e) => setConfig({ ...config, latest_delivery_slot_start: e.target.value })}
                  className="text-xs font-semibold rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Latest Slot End</Label>
                <Input
                  type="time"
                  value={config.latest_delivery_slot_end || "22:00"}
                  onChange={(e) => setConfig({ ...config, latest_delivery_slot_end: e.target.value })}
                  className="text-xs font-semibold rounded-xl"
                />
              </div>
            </div>
          </div>
        </Container>

        {/* Section 1.4: Express 45-Min Delivery Rules */}
        <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Zap className="w-5 h-5 text-brand-gold" />
            <h3 className="font-extrabold text-sm text-slate-900">⚡ Express 45-Min Priority Delivery Rules</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Express 45-Min Delivery Mode</span>
                <span className="text-[11px] text-slate-500">Enable priority instant courier dispatch mode</span>
              </div>
              <Switch
                checked={config.express_delivery?.enabled ?? true}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    express_delivery: {
                      ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                      enabled: checked,
                    },
                  })
                }
              />
            </div>

            {config.express_delivery?.enabled && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-brand-gold-light/50 border border-brand-gold/80">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Operating Start</Label>
                    <Input
                      type="time"
                      value={config.express_delivery?.start_time || "09:00"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          express_delivery: {
                            ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                            start_time: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Operating End</Label>
                    <Input
                      type="time"
                      value={config.express_delivery?.end_time || "21:00"}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          express_delivery: {
                            ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                            end_time: e.target.value,
                          },
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Surcharge (₹)</Label>
                    <Input
                      type="number"
                      value={config.express_delivery?.surcharge ?? 99}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          express_delivery: {
                            ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                            surcharge: Number(e.target.value) || 0,
                          },
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Max Capacity</Label>
                    <Input
                      type="number"
                      value={config.express_delivery?.max_capacity ?? 5}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          express_delivery: {
                            ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                            max_capacity: Number(e.target.value) || 5,
                          },
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-brand-gold/40 mt-2">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800">Same-Day Only Delivery</span>
                    <span className="text-[10px] text-slate-500">
                      Express 45-Min is strictly for same-day delivery. Will NOT be shown when customer selects tomorrow or future dates.
                    </span>
                  </div>
                  <Switch
                    checked={config.express_delivery?.same_day_only ?? true}
                    onCheckedChange={(checked) =>
                      setConfig({
                        ...config,
                        express_delivery: {
                          ...(config.express_delivery || DEFAULT_EXPRESS_CONFIG),
                          same_day_only: checked,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>
        </Container>

        

        {/* Section 1.6: Store Pickup Fulfillment Configuration */}
        <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Store className="w-5 h-5 text-emerald-600" />
            <h3 className="font-extrabold text-sm text-slate-900">🏪 Kitchen Hub Store Pickup Configuration</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800">Enable Customer Store Pickup</span>
                <span className="text-[11px] text-slate-500">Allow customers to select and collect orders directly from kitchen hubs (FREE)</span>
              </div>
              <Switch
                checked={config.store_pickup_enabled ?? true}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    store_pickup_enabled: checked,
                  })
                }
              />
            </div>

            {config.store_pickup_enabled !== false && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200/80">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Pickup Lead Time (Minutes)</Label>
                    <Input
                      type="number"
                      value={config.store_pickup_lead_time_minutes ?? 30}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          store_pickup_lead_time_minutes: Number(e.target.value) || 30,
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                      placeholder="30"
                    />
                    <span className="text-[10px] text-slate-400 leading-tight block">
                      Minimum preparation lead time required before customer can collect.
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700">Convenience Fee (₹)</Label>
                    <Input
                      type="number"
                      value={config.store_pickup_convenience_fee ?? 0}
                      onChange={(e) =>
                        setConfig({
                          ...config,
                          store_pickup_convenience_fee: Number(e.target.value) || 0,
                        })
                      }
                      className="text-xs font-semibold rounded-xl bg-white"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-slate-400 leading-tight block">
                      Typically ₹0 (Free store collection).
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Container>

        {/* Section 2: Global Preparation Delay (Rush Hour / Peak Load) */}
        <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Timer className="w-5 h-5 text-brand-gold" />
            <div className="flex items-center justify-between flex-1">
              <h3 className="font-extrabold text-sm text-slate-900">Kitchen Rush & Preparation Delay</h3>
              {config.global_preparation_delay_enabled && (
                <Badge color="orange" className="bg-brand-gold-light text-brand-gold-dark border-brand-gold/40 font-bold">
                  +{config.global_preparation_delay_minutes}m DELAY ACTIVE
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-brand-gold-light/70 border border-brand-gold/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-brand-gold-dark">Activate Kitchen Peak Delay</span>
                  <span className="text-[11px] text-brand-gold-dark">
                    Temporarily add prep buffer across all products during peak holiday/festival rush
                  </span>
                </div>
                <Switch
                  checked={config.global_preparation_delay_enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, global_preparation_delay_enabled: checked })}
                />
              </div>

              {config.global_preparation_delay_enabled && (
                <div className="space-y-3 pt-3 border-t border-brand-gold/40">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-brand-gold-dark">Additional Prep Minutes (+min)</Label>
                    <Input
                      type="number"
                      value={config.global_preparation_delay_minutes}
                      onChange={(e) => setConfig({ ...config, global_preparation_delay_minutes: Number(e.target.value) || 0 })}
                      className="text-xs font-semibold rounded-xl bg-white"
                      placeholder="e.g. 30"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-brand-gold-dark">Reason / Customer Notice</Label>
                    <Input
                      type="text"
                      value={config.preparation_delay_reason || ""}
                      onChange={(e) => setConfig({ ...config, preparation_delay_reason: e.target.value })}
                      className="text-xs rounded-xl bg-white"
                      placeholder="e.g. High order volume during Valentine's Day peak"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
              <span className="font-bold text-slate-800">Cascading Precedence Rule:</span>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Product Rule &gt; Branch Availability Override &gt; Global Default.
                Lower-level branch or product rules can restrict delivery earlier, but can NEVER bypass the Corporate Same-Day Acceptance Cutoff.
              </p>
            </div>
          </div>
        </Container>

        {/* Section 2.5: Emergency Operations Override (Phase 21) */}
        <Container className="col-span-1 md:col-span-2 p-6 rounded-3xl border border-rose-200 bg-rose-50/40 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-rose-200">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-rose-700" />
              <h3 className="font-extrabold text-sm text-slate-900">Authorized Emergency Operations Override</h3>
            </div>
            {config.emergency_override_active ? (
              <Badge color="red" className="bg-rose-600 text-white font-bold animate-pulse">
                EMERGENCY OVERRIDE ACTIVE ({config.emergency_override_cutoff_time || "20:30"})
              </Badge>
            ) : (
              <Badge color="grey" className="bg-slate-100 text-slate-600 font-semibold">
                INACTIVE
              </Badge>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-white border border-rose-200">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-900">Activate Corporate Cutoff Extension</span>
                <span className="text-[11px] text-slate-500">
                  Allows Super Admin / Operations Head to temporarily extend same-day corporate order acceptance window
                </span>
              </div>
              <Switch
                checked={config.emergency_override_active || false}
                onCheckedChange={(checked) =>
                  setConfig({
                    ...config,
                    emergency_override_active: checked,
                    emergency_override_updated_at: new Date().toISOString(),
                  })
                }
              />
            </div>

            {config.emergency_override_active && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 rounded-2xl bg-white border border-rose-200 animate-in fade-in">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">Override Cutoff Time</Label>
                  <Input
                    type="time"
                    value={config.emergency_override_cutoff_time || "20:30"}
                    onChange={(e) => setConfig({ ...config, emergency_override_cutoff_time: e.target.value })}
                    className="text-xs font-semibold rounded-xl"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-bold text-slate-700">Mandatory Justification / Reason</Label>
                  <Input
                    type="text"
                    value={config.emergency_override_reason || ""}
                    onChange={(e) => setConfig({ ...config, emergency_override_reason: e.target.value })}
                    className="text-xs font-semibold rounded-xl"
                    placeholder="e.g. Festival Eve VIP Catering Approval by Head of Operations"
                  />
                </div>
              </div>
            )}
          </div>
        </Container>
      </div>

      {/* Section 3: Weekly Operating Schedule */}
      <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-primary" />
            <h3 className="font-extrabold text-sm text-slate-900">Weekly Operating Hours Schedule</h3>
          </div>
          <span className="text-xs font-semibold text-slate-500">Changes auto-save per day</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {DAY_NAMES.map((dayName, idx) => {
            const dayEntry = operatingHours.find((h) => h.day_of_week === idx) || {
              entity_type: "organization",
              entity_id: "global",
              day_of_week: idx,
              is_open: true,
              opening_time: "09:00",
              closing_time: "22:00",
              timezone: config.business_timezone,
            };

            return (
              <div
                key={dayName}
                className={`p-3.5 rounded-2xl border flex flex-col gap-2.5 transition ${
                  dayEntry.is_open
                    ? "bg-slate-50/80 border-slate-200 shadow-sm"
                    : "bg-gray-100/60 border-gray-200 opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-black text-xs text-slate-900">{dayName}</span>
                  <Switch
                    checked={dayEntry.is_open}
                    onCheckedChange={(checked) => handleUpdateHours(idx, "is_open", checked)}
                  />
                </div>

                {dayEntry.is_open ? (
                  <div className="space-y-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Open</span>
                      <Input
                        type="time"
                        value={dayEntry.opening_time}
                        onChange={(e) => handleUpdateHours(idx, "opening_time", e.target.value)}
                        className="text-xs p-1.5 h-8 font-semibold"
                      />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Close</span>
                      <Input
                        type="time"
                        value={dayEntry.closing_time}
                        onChange={(e) => handleUpdateHours(idx, "closing_time", e.target.value)}
                        className="text-xs p-1.5 h-8 font-semibold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Closed
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Container>

      {/* Section 4: Holiday Calendar Management */}
      <Container className="p-6 rounded-3xl border border-slate-200 bg-white shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-primary" />
            <h3 className="font-extrabold text-sm text-slate-900">Holiday & Operational Closures Calendar</h3>
          </div>
          <span className="text-xs text-slate-500 font-semibold">{holidays.length} scheduled closures</span>
        </div>

        {/* Add Holiday Form */}
        <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 items-end">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Closure Date</Label>
            <Input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              className="text-xs font-semibold rounded-xl bg-white"
              required
            />
          </div>

          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs font-bold text-slate-700">Holiday Name / Reason</Label>
            <Input
              type="text"
              value={newHolidayName}
              onChange={(e) => setNewHolidayName(e.target.value)}
              placeholder="e.g. Independence Day, Annual Kitchen Maintenance"
              className="text-xs rounded-xl bg-white"
              required
            />
          </div>

          <Button
            type="submit"
            className="bg-brand-primary hover:bg-brand-primary text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 h-10"
          >
            <Plus className="w-4 h-4" />
            Add Closure
          </Button>
        </form>

        {/* Holiday List */}
        {holidays.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-medium">
            No scheduled closures or holidays. Deliveries will operate 365 days a year based on weekly schedule.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {holidays.map((h) => (
              <div
                key={h.id || `${h.date}_${h.name}`}
                className="p-3.5 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-sm"
              >
                <div className="flex flex-col">
                  <span className="font-black text-xs text-slate-900">{h.name}</span>
                  <span className="text-[11px] text-slate-500 font-semibold">{h.date}</span>
                  <Badge color="red" className="mt-1 w-fit text-[10px] py-0 px-2">
                    {h.is_full_day ? "Full Day Closure" : "Partial Closure"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>

      {/* Section 5: Live Slot Preview Simulator (Direct Cascading Verification) */}
      <Container className="p-6 rounded-3xl border border-brand-primary/30 bg-gradient-to-br from-brand-light/50 via-white to-brand-light/30 shadow-md space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-brand-light">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-brand-primary" />
            <div>
              <h3 className="font-extrabold text-sm text-slate-900">Live Customer Delivery Slot Simulator</h3>
              <p className="text-[11px] text-slate-500">Preview exact customer slot schedule generated from active configuration (Global &gt; Store &gt; Zone)</p>
            </div>
          </div>
          <Badge color="purple" className="bg-brand-light text-brand-navy font-bold border-brand-primary/30">
            Realtime Engine Simulator
          </Badge>
        </div>

        {/* Simulator Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-2xl bg-white border border-brand-light shadow-sm">
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Target Store</Label>
            <select
              value={simBranchId}
              onChange={(e) => setSimBranchId(e.target.value)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 p-2.5 h-10"
            >
              {simBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Target Date</Label>
            <Input
              type="date"
              value={simDate}
              onChange={(e) => setSimDate(e.target.value)}
              className="text-xs font-semibold rounded-xl bg-slate-50 h-10"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Fulfillment Type</Label>
            <select
              value={simMode}
              onChange={(e) => setSimMode(e.target.value as any)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 p-2.5 h-10"
            >
              <option value="delivery">Home Delivery</option>
              <option value="pickup">Store Pickup</option>
            </select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700">Mode Filter</Label>
            <select
              value={simDeliveryMode}
              onChange={(e) => setSimDeliveryMode(e.target.value as any)}
              className="w-full text-xs font-semibold rounded-xl border border-slate-200 bg-slate-50 p-2.5 h-10"
            >
              <option value="all">All Modes (Standard + Express)</option>
              <option value="standard">Standard Scheduled Slots Only</option>
              <option value="express">⚡ Express 45-Min Only</option>
              
            </select>
          </div>
        </div>

        {/* Simulator Results Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700">
            <span>Generated Customer Slots ({simSlots.length} Total Windows):</span>
            <span className="text-brand-primary font-mono text-[11px]">
              Active: {simSlots.filter((s) => s.available).length} Available | {simSlots.filter((s) => !s.available).length} Closed/Cutoff
            </span>
          </div>

          {loadingSim ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 bg-slate-100 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : simSlots.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center text-xs text-slate-400">
              No operational slots generated for the selected parameters. (Store may be closed on this day or outside operating window).
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {simSlots.map((slot) => {
                const isAvail = slot.available;
                return (
                  <div
                    key={slot.id}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2 transition ${
                      isAvail
                        ? slot.slot_type === "express"
                          ? "bg-brand-gold-light/80 border-brand-gold/40 shadow-sm"
                          : "bg-white border-emerald-200 shadow-sm"
                        : "bg-slate-50 border-slate-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-extrabold text-xs text-slate-900 block truncate">
                          {slot.slot_name || slot.id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500 font-semibold">
                          {slot.start_time} - {slot.end_time}
                        </span>
                      </div>
                      <Badge
                        color={isAvail ? "green" : "red"}
                        className={`text-[10px] uppercase font-bold shrink-0 ${
                          isAvail
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-rose-100 text-rose-800 border-rose-200"
                        }`}
                      >
                        {slot.status || (isAvail ? "AVAILABLE" : "UNAVAILABLE")}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-[11px] border-t border-slate-100 pt-2 mt-1">
                      <span className="text-slate-500">
                        Cap: <b>{slot.remaining_capacity ?? slot.max_capacity}</b>/{slot.max_capacity || 10} left
                      </span>
                      {slot.extra_charge > 0 && (
                        <span className="font-extrabold text-rose-600">
                          +₹{slot.extra_charge} Fee
                        </span>
                      )}
                    </div>

                    {!isAvail && slot.reason_message && (
                      <p className="text-[10px] text-rose-600 font-medium">
                        ⚠️ {slot.reason_message}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
});
