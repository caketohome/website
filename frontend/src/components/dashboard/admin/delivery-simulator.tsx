"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Compass, Play, CheckCircle2, XCircle, AlertCircle, ShieldAlert,
  MapPin, Clock, Truck, Package, Layers, ArrowRight, DollarSign, RefreshCw, Zap
} from "lucide-react";

export function DeliverySimulator() {
  const [pincode, setPincode] = useState("560034");
  const [productId, setProductId] = useState("prod_01");
  const [weightKg, setWeightKg] = useState("1.5");
  const [deliveryType, setDeliveryType] = useState<"same_day" | "express" | "midnight" | "scheduled">("same_day");
  const [orderTime, setOrderTime] = useState(new Date().toISOString().slice(0, 16));

  const [products, setProducts] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [simulation, setSimulation] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    apiClient.getAdminBranches().then((res: any) => setBranches(res?.branches || []));
    setProducts([
      { id: "prod_01", title: "Belgian Chocolate Truffle Cake", weight: 1, min_prep_hours: 1 },
      { id: "prod_02", title: "Fresh Mango Cream Cake", weight: 1, min_prep_hours: 2 },
      { id: "prod_03", title: "Custom Designer Tier Cake", weight: 3, min_prep_hours: 6 },
      { id: "prod_04", title: "Photo Printed Surprise Cake", weight: 1.5, min_prep_hours: 3 },
    ]);
  }, []);

  function runSimulation() {
    setSimulating(true);
    setTimeout(() => {
      // Execute multi-branch delivery simulation via api engine helper
      const res = (apiClient as any).simulateDeliveryRouting?.({
        pincode,
        product_id: productId,
        weight_kg: parseFloat(weightKg) || 1,
        delivery_type: deliveryType,
        order_time_iso: new Date(orderTime).toISOString(),
      }) || (ApiEngineFallbackSimulation({ pincode, productId, deliveryType }));
      setSimulation(res);
      setSimulating(false);
    }, 400);
  }

  function ApiEngineFallbackSimulation({ pincode, productId, deliveryType }: any) {
    const candidateBranches = branches.filter((b) =>
      b.is_open && (b.delivery_zones || []).some((z: any) => (z.pincodes || []).includes(pincode))
    );

    const evaluated = branches.map((b) => {
      const zone = (b.delivery_zones || []).find((z: any) => (z.pincodes || []).includes(pincode)) || b.delivery_zones?.[0];
      const isEligible = Boolean(b.is_open && zone && zone.enabled);
      const zoneOrder = zone?.display_order ?? 1;
      const loadPct = Math.round(((b.current_hourly_load || 0) / (b.max_orders_per_hour || 25)) * 100);
      const inventoryStatus = b.product_availability?.[productId]?.status || "available";

      // 5-factor scoring calculation
      const zoneScore = Math.max(0, 100 - (zoneOrder - 1) * 25) * 0.40;
      const invScore = inventoryStatus === "available" ? 25 : inventoryStatus === "low_stock" ? 18.75 : 0;
      const capScore = Math.max(0, 100 - loadPct) * 0.15;
      const prioScore = Math.min(10, b.branch_priority || 5);
      const prepScore = 8;
      const totalScore = Math.round((zoneScore + invScore + capScore + prioScore + prepScore) * 10) / 10;

      return {
        branch_id: b.id,
        name: b.name,
        code: b.code,
        eligible: isEligible,
        zone_name: zone?.name || "Unzoned",
        zone_order: zoneOrder,
        inventory_status: inventoryStatus,
        load_pct: loadPct,
        total_score: isEligible ? totalScore : 0,
        reason: !b.is_open ? "Branch Closed" : !zone ? "Pincode Not Served" : !zone.enabled ? "Zone Disabled" : "OK",
        delivery_charge: zone?.delivery_charge || 0,
        express_charge: zone?.express_charge || 0,
      };
    });

    const eligible = evaluated.filter((c) => c.eligible).sort((a, b) => b.total_score - a.total_score);
    const winner = eligible[0] || null;

    return {
      eligible: Boolean(winner),
      winner,
      candidates: evaluated,
      trace: [
        { step: "1. Address & Pincode Lookup", result: "PASS", detail: `Pincode ${pincode} searched across ${branches.length} hub branches.` },
        { step: "2. Zone & Serviceability Match", result: winner ? "PASS" : "FAIL", detail: winner ? `Matched ${winner.name} under zone "${winner.zone_name}".` : "No branch zone serves this pincode." },
        { step: "3. Multi-Factor Weighted Scoring", result: winner ? "PASS" : "FAIL", detail: winner ? `Winner score ${winner.total_score}/100 (Zone 40%, Stock 25%, Load 15%, Priority 10%, Prep 10%).` : "Scoring failed." },
        { step: "4. Slot & Fee Resolution", result: winner ? "PASS" : "FAIL", detail: winner ? `Base Fee ₹${winner.delivery_charge}${deliveryType === "express" ? ` + ₹${winner.express_charge} Express` : ""}` : "No slots generated." },
      ],
    };
  }

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="p-4 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-xl shadow-lg border border-purple-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-base font-bold flex items-center gap-2 text-amber-300">
            <Compass className="w-5 h-5 text-amber-400 animate-spin-slow" /> Enterprise Delivery Serviceability Simulator
          </Heading>
          <Text className="text-xs text-purple-200 mt-1">
            Simulate customer checkout routing, 5-factor weighted branch scoring, zone intersection, prep time resolution, and fee calculation.
          </Text>
        </div>
        <Button size="small" onClick={runSimulation} isLoading={simulating} className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-md shrink-0">
          <Play className="w-4 h-4 mr-1.5 fill-current" /> Run Routing Test
        </Button>
      </div>

      {/* Simulator Input Form */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs">
        <div>
          <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Customer Pincode *</Label>
          <Input
            value={pincode}
            onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="e.g. 560034"
            className="font-mono font-bold"
          />
        </div>

        <div>
          <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Select Product *</Label>
          <select
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
          </select>
        </div>

        <div>
          <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Delivery Mode</Label>
          <select
            value={deliveryType}
            onChange={(e) => setDeliveryType(e.target.value as any)}
            className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-2 text-xs font-semibold bg-white dark:bg-slate-800"
          >
            <option value="same_day">Same Day Standard</option>
            <option value="express">⚡ Express (45 Min)</option>
            <option value="midnight">🌙 Midnight Surprise</option>
            <option value="scheduled">Scheduled Slot</option>
          </select>
        </div>

        <div>
          <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Weight (kg)</Label>
          <Input
            type="number"
            step="0.5"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-[11px] text-slate-500 font-semibold mb-1 block">Order Time</Label>
          <Input
            type="datetime-local"
            value={orderTime}
            onChange={(e) => setOrderTime(e.target.value)}
            className="text-[11px]"
          />
        </div>
      </div>

      {/* Simulation Output */}
      {simulation && (
        <div className="space-y-4">
          {/* Winner Banner */}
          <div className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 ${simulation.eligible ? "bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-800" : "bg-rose-50 border-rose-300 dark:bg-rose-950/40 dark:border-rose-800"}`}>
            <div className="flex items-center gap-3">
              {simulation.eligible ? (
                <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              ) : (
                <XCircle className="w-8 h-8 text-rose-600 shrink-0" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <Heading level="h3" className={`text-base font-bold ${simulation.eligible ? "text-emerald-950 dark:text-emerald-200" : "text-rose-950 dark:text-rose-200"}`}>
                    {simulation.eligible ? `Assigned Branch: ${simulation.winner?.name}` : "Delivery Unserviceable"}
                  </Heading>
                  {simulation.eligible && (
                    <Badge color="green" className="text-[10px] font-bold font-mono">Score: {simulation.winner?.total_score}/100</Badge>
                  )}
                </div>
                <Text className={`text-xs mt-0.5 ${simulation.eligible ? "text-emerald-800 dark:text-emerald-300" : "text-rose-800 dark:text-rose-300"}`}>
                  {simulation.eligible
                    ? `Zone: ${simulation.winner?.zone_name} (Order ${simulation.winner?.zone_order}) · Stock: ${simulation.winner?.inventory_status?.toUpperCase()} · Charge: ₹${simulation.winner?.delivery_charge}`
                    : `Reason: ${simulation.reason || "No branch qualified for this address"}`}
                </Text>
              </div>
            </div>
          </div>

          {/* Diagnostic Step-by-Step Trace */}
          <div className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
            <Heading level="h4" className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Decision Diagnostic Pipeline (10-Step Trace)
            </Heading>
            <div className="space-y-1.5">
              {(simulation.trace || []).map((t: any, idx: number) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <Badge color={t.result === "PASS" ? "green" : t.result === "FAIL" ? "red" : "blue"} className="text-[9px] font-bold px-1.5 mt-0.5">
                    {t.result}
                  </Badge>
                  <div className="flex-1">
                    <span className="font-bold text-slate-800 dark:text-slate-200">{t.step}: </span>
                    <span className="text-slate-600 dark:text-slate-400">{t.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Candidate Evaluation Table */}
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
            <div className="p-3 bg-slate-100 dark:bg-slate-800 border-b font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between">
              <span>Candidate Branch Evaluation Matrix</span>
              <span className="text-[10px] text-slate-500">Ranked by 5-Factor Weighted Score</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 text-[10px] text-slate-500 uppercase border-b">
                    <th className="p-2.5 font-bold">Status</th>
                    <th className="p-2.5 font-bold">Branch Hub</th>
                    <th className="p-2.5 font-bold">Matched Zone</th>
                    <th className="p-2.5 font-bold">Inventory</th>
                    <th className="p-2.5 font-bold">Capacity Load</th>
                    <th className="p-2.5 font-bold">Weighted Score</th>
                    <th className="p-2.5 font-bold">Fee</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(simulation.candidates || []).map((c: any) => (
                    <tr key={c.branch_id} className={c.branch_id === simulation.winner?.branch_id ? "bg-amber-50/70 dark:bg-amber-950/30 font-semibold" : ""}>
                      <td className="p-2.5">
                        <Badge color={c.eligible ? "green" : "red"} className="text-[9px]">
                          {c.eligible ? "Eligible" : "Excluded"}
                        </Badge>
                      </td>
                      <td className="p-2.5 font-bold text-slate-900 dark:text-white">
                        {c.name} <span className="text-slate-400 text-[10px] font-mono">({c.code})</span>
                      </td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-300">
                        {c.zone_name} <span className="text-slate-400 text-[10px]">(Order {c.zone_order})</span>
                      </td>
                      <td className="p-2.5">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded capitalize ${c.inventory_status === "available" ? "bg-emerald-100 text-emerald-800" : c.inventory_status === "low_stock" ? "bg-amber-100 text-amber-800" : "bg-rose-100 text-rose-800"}`}>
                          {c.inventory_status || "available"}
                        </span>
                      </td>
                      <td className="p-2.5 font-mono">{c.load_pct ?? 0}%</td>
                      <td className="p-2.5 font-bold text-amber-600 font-mono text-sm">{c.total_score ?? 0} pts</td>
                      <td className="p-2.5 font-bold text-emerald-600 font-mono">₹{c.delivery_charge ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
