"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { ShoppingBag, Plus, Minus, AlertTriangle, ArrowRightLeft, ShieldCheck } from "lucide-react";

interface BranchAccessoryInventoryModalProps {
  branch: any;
  onClose: () => void;
}

export function BranchAccessoryInventoryModal({ branch, onClose }: BranchAccessoryInventoryModalProps) {
  const [accessories, setAccessories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState<number>(5);
  const [adjustReason, setAdjustReason] = useState<string>("Weekly Stock Transfer");
  const [submitting, setSubmitting] = useState(false);

  const fetchAccessories = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAccessories({ branchId: branch.id });
      setAccessories(res?.accessories || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessories();
  }, [branch.id]);

  const handleAdjustStock = async (accId: string, delta: number) => {
    setSubmitting(true);
    try {
      await apiClient.adjustBranchAccessoryStock(branch.id, accId, delta, adjustReason);
      setAdjustingId(null);
      fetchAccessories();
    } catch (err: any) {
      alert(err.message || "Failed to adjust stock");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b bg-brand-light/70 dark:bg-brand-navy/40 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-bold flex items-center gap-2 text-brand-navy dark:text-brand-primary/30">
              <ShoppingBag className="w-5 h-5 text-brand-primary" /> Branch Accessory Physical Inventory Tracker
            </Heading>
            <Text className="text-xs text-brand-navy dark:text-brand-primary/30">
              Hub: <span className="font-bold">{branch.name}</span> ({branch.code}) • Track physical stock, reserved items, low stock alerts & stock transfers.
            </Text>
          </div>
          <Button size="small" variant="transparent" onClick={onClose}>✕ Close</Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading branch accessory inventory...</div>
          ) : accessories.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No accessories found in master catalog.</div>
          ) : (
            <div className="space-y-3">
              {accessories.map((acc) => {
                const bStock = {
                  current_stock: Number(acc.stock ?? acc.current_stock ?? 0),
                  reserved_stock: Number(acc.reserved ?? acc.reserved_stock ?? 0),
                  available_stock: Number(acc.available_stock ?? (Number(acc.stock || 0) - Number(acc.reserved || 0))),
                  low_stock_threshold: Number(acc.low_stock_threshold || 5),
                };

                const isLowStock = bStock.available_stock <= bStock.low_stock_threshold;
                const isAdjusting = adjustingId === acc.id;

                return (
                  <div key={acc.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 shadow-sm">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {acc.thumbnail && (
                          <img src={acc.thumbnail} alt={acc.name} className="w-10 h-10 object-cover rounded-lg border shrink-0" />
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-900 dark:text-white">{acc.name}</span>
                            <Badge color="purple" className="text-[10px] font-mono">{acc.sku}</Badge>
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Category: {acc.category_name || "Accessories"} • Price: ₹{acc.price}
                          </div>
                        </div>
                      </div>

                      <Badge color={isLowStock ? "red" : "green"} className="font-bold text-xs">
                        {isLowStock ? "⚠️ Low Stock Alert" : "In Stock"}
                      </Badge>
                    </div>

                    {/* Stock Table */}
                    <div className="grid grid-cols-4 gap-2 text-center p-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl border">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Current Physical</span>
                        <span className="font-extrabold text-sm text-slate-900 dark:text-white">{bStock.current_stock}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Reserved (Active Orders)</span>
                        <span className="font-extrabold text-sm text-brand-gold">{bStock.reserved_stock}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Net Available</span>
                        <span className="font-extrabold text-sm text-emerald-600">{bStock.available_stock}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-semibold">Alert Threshold</span>
                        <span className="font-bold text-xs text-rose-500">{bStock.low_stock_threshold}</span>
                      </div>
                    </div>

                    {/* Adjust Form */}
                    {isAdjusting ? (
                      <div className="p-3 bg-brand-light dark:bg-brand-navy/30 rounded-xl border border-brand-primary/30 space-y-3">
                        <div className="flex items-center justify-between font-bold text-brand-navy dark:text-brand-primary/30">
                          <span>Adjust Stock for "{acc.name}"</span>
                          <Button size="small" variant="transparent" onClick={() => setAdjustingId(null)}>Cancel</Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <Label>Reason *</Label>
                            <Input value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="e.g. Hub Transfer / Restock" />
                          </div>
                          <div className="flex items-end gap-2">
                            <Button
                              size="small"
                              onClick={() => handleAdjustStock(acc.id, adjustDelta)}
                              isLoading={submitting}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex-1"
                            >
                              <Plus className="w-4 h-4 mr-1" /> Add (+{adjustDelta})
                            </Button>
                            <Button
                              size="small"
                              variant="danger"
                              onClick={() => handleAdjustStock(acc.id, -adjustDelta)}
                              isLoading={submitting}
                              className="font-bold flex-1"
                            >
                              <Minus className="w-4 h-4 mr-1" /> Deduct (-{adjustDelta})
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-end">
                        <Button size="small" variant="secondary" onClick={() => setAdjustingId(acc.id)} className="font-bold text-xs">
                          <ArrowRightLeft className="w-3.5 h-3.5 mr-1 text-brand-primary" /> Stock Adjustment / Transfer
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
