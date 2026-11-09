"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Badge, Button, Input } from "@medusajs/ui";
import {
  Package,
  Layers,
  RefreshCw,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  Search,
  Sliders,
} from "lucide-react";

interface SharedStockItem {
  id: string;
  product_id: string;
  variant_id?: string;
  product_title: string;
  category: "CAKE" | "BOUQUET";
  quantity: number;
  reserved: number;
  available: number;
  safety_stock_threshold: number;
  unit_of_measure: string;
  last_counted_at: string;
}

export const SharedInventoryPanel = memo(function SharedInventoryPanel() {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<SharedStockItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Stock Adjustment Drawer / Modal State
  const [adjustingItem, setAdjustingItem] = useState<SharedStockItem | null>(null);
  const [adjustmentDelta, setAdjustmentDelta] = useState<number>(0);
  const [adjustmentReason, setAdjustmentReason] = useState<string>("FRESH_STOCK_ARRIVAL");
  const [adjustmentNotes, setAdjustmentNotes] = useState<string>("");
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/inventory/shared");
      const data = await res.json();
      if (data.items) {
        setItems(data.items);
      }
    } catch (err: any) {
      setErrorMsg("Failed to load shared inventory: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || adjustmentDelta === 0) {
      setErrorMsg("Please specify a non-zero adjustment delta.");
      return;
    }
    try {
      setSubmittingAdjustment(true);
      setErrorMsg(null);
      const res = await fetch("/api/v1/inventory/shared/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustingItem.product_id,
          variantId: adjustingItem.variant_id,
          quantityDelta: adjustmentDelta,
          movementType: adjustmentDelta > 0 ? "MANUAL_INCREASE" : "MANUAL_DECREASE",
          reason: `${adjustmentReason}: ${adjustmentNotes}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to adjust stock");
      }
      setSuccessMsg(
        `Successfully adjusted ${adjustingItem.product_title}: Physical ${data.item.quantity}, Reserved ${data.item.reserved}`
      );
      setAdjustingItem(null);
      setAdjustmentDelta(0);
      setAdjustmentNotes("");
      fetchInventory();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesCategory =
      categoryFilter === "ALL" || item.category === categoryFilter;
    const matchesSearch =
      !searchQuery ||
      item.product_title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.product_id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalPhysical = items.reduce((acc, i) => acc + Number(i.quantity), 0);
  const totalReserved = items.reduce((acc, i) => acc + Number(i.reserved), 0);
  const totalAvailable = totalPhysical - totalReserved;

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-900/40 text-white shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <Heading level="h2" className="text-xl font-bold tracking-tight text-white">
              Shared Cake & Bouquet Central Inventory Pool
            </Heading>
            <Badge color="green" className="text-xs font-semibold px-2.5 py-0.5">
              PostgreSQL Single Truth
            </Badge>
          </div>
          <Text className="text-sm text-slate-300 max-w-3xl">
            Central authoritative stock truth for cakes and bouquets. Shared across authorized branches and marketplace partners with atomic reservation locks (`SELECT ... FOR UPDATE`), zero overselling, and full auditable movement ledger.
          </Text>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="small"
            onClick={fetchInventory}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Tracked SKUs</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{items.length}</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-medium text-slate-500">Total Central Stock</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{totalPhysical}</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-xs font-medium text-amber-500">Active Order Reservations</div>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{totalReserved}</div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/40 shadow-sm bg-emerald-50/20">
          <div className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Net Available to Promise</div>
          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{totalAvailable}</div>
        </div>
      </div>

      {/* Alerts */}
      {errorMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{errorMsg}</Text>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <Text className="text-sm font-medium">{successMsg}</Text>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Category:</span>
          {(["ALL", "CAKE", "BOUQUET"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                categoryFilter === cat
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              }`}
            >
              {cat === "ALL" ? "All Categories" : cat === "CAKE" ? "🎂 Cakes" : "💐 Bouquets"}
            </button>
          ))}
        </div>

        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search cake or bouquet title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-medium">
                <th className="py-3 px-4">Item & Variant</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Physical Stock</th>
                <th className="py-3 px-4 text-center">Reserved</th>
                <th className="py-3 px-4 text-center">Available to Promise</th>
                <th className="py-3 px-4 text-center">Safety Threshold</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No shared inventory items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const avail = Number(item.quantity) - Number(item.reserved);
                  const isLow = avail <= Number(item.safety_stock_threshold);
                  const isOut = avail <= 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {item.product_title}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          ID: {item.product_id} {item.variant_id ? `| Var: ${item.variant_id}` : ""}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.category === "CAKE"
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-pink-500/10 text-pink-500 border border-pink-500/20"
                          }`}
                        >
                          {item.category === "CAKE" ? "🎂 CAKE" : "💐 BOUQUET"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-slate-900 dark:text-white">
                        {item.quantity} {item.unit_of_measure}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold text-amber-600 dark:text-amber-400">
                        {item.reserved}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {avail}
                      </td>
                      <td className="py-3 px-4 text-center text-slate-500">
                        {item.safety_stock_threshold}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isOut
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : isLow
                              ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                          }`}
                        >
                          {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "OPTIMAL"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => {
                            setAdjustingItem(item);
                            setAdjustmentDelta(0);
                            setAdjustmentReason("FRESH_STOCK_ARRIVAL");
                            setAdjustmentNotes("");
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 dark:border-rose-800"
                        >
                          Adjust Stock
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <Heading level="h3" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-rose-500" />
                Authoritative Stock Adjustment
              </Heading>
              <button
                onClick={() => setAdjustingItem(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <div className="font-semibold text-slate-900 dark:text-white">{adjustingItem.product_title}</div>
              <div className="text-slate-500 mt-1">
                Current Physical: <span className="font-bold text-slate-900 dark:text-white">{adjustingItem.quantity}</span> |
                Reserved: <span className="font-bold text-amber-500">{adjustingItem.reserved}</span> |
                Available: <span className="font-bold text-emerald-500">{Number(adjustingItem.quantity) - Number(adjustingItem.reserved)}</span>
              </div>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">
                  Adjustment Delta (+ for increase, - for decrease) *
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustmentDelta((d) => d - 1)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    required
                    value={adjustmentDelta}
                    onChange={(e) => setAdjustmentDelta(parseInt(e.target.value) || 0)}
                    className="w-full p-2 text-center font-bold text-base rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setAdjustmentDelta((d) => d + 1)}
                    className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  New Physical Stock will be:{" "}
                  <span className="font-bold text-slate-900 dark:text-white">
                    {Number(adjustingItem.quantity) + Number(adjustmentDelta)}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Reason Category *</label>
                <select
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="FRESH_STOCK_ARRIVAL">Fresh Batch Received from Kitchen / Florist</option>
                  <option value="INVENTORY_COUNT_CORRECTION">Periodic Physical Audit Count Correction</option>
                  <option value="DAMAGE_OR_SPOILAGE">Damage / Spoilage / Expired Ingredients</option>
                  <option value="SAMPLE_OR_TASTING">Internal Sample / Promotional Display</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 mb-1 font-semibold">Internal Notes / Reference</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Morning bakery intake batch #482"
                  value={adjustmentNotes}
                  onChange={(e) => setAdjustmentNotes(e.target.value)}
                  className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setAdjustingItem(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="bg-rose-600 hover:bg-rose-500 text-white"
                  disabled={submittingAdjustment || adjustmentDelta === 0}
                >
                  Confirm & Commit to PostgreSQL
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
