"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label } from "@medusajs/ui";
import { Truck, Save, CheckCircle2, Clock, Zap, Moon } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function DeliveryDefaultsTab({
  deliveryDefaults,
  onUpdated,
}: {
  deliveryDefaults: any;
  onUpdated: (updated: any) => void;
}) {
  const [formData, setFormData] = useState({
    free_delivery_threshold: deliveryDefaults?.free_delivery_threshold ?? 599,
    default_delivery_fee: deliveryDefaults?.default_delivery_fee ?? 49,
    express_delivery_fee: deliveryDefaults?.express_delivery_fee ?? 99,
    midnight_delivery_fee: 0,
    default_prep_time_mins: deliveryDefaults?.default_prep_time_mins ?? 30,
    default_slot_duration_mins: deliveryDefaults?.default_slot_duration_mins ?? 60,
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res: any = await apiClient.updateDeliveryDefaults(formData);
      const updated = res?.defaults || res?.data || formData;
      onUpdated(updated);
      setSuccessMsg("Platform delivery defaults saved successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to save delivery defaults: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {successMsg && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Platform Delivery & Operational Defaults</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Default pricing rules and preparation buffers applied when individual store or zone overrides are not specified.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Delivery Defaults
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pricing Rules */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Truck className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Delivery Thresholds & Surcharges
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="free_thresh" className="text-xs font-semibold">Free Delivery Order Threshold (₹)</Label>
              <Input
                id="free_thresh"
                type="number"
                value={String(formData.free_delivery_threshold)}
                onChange={(e) => setFormData({ ...formData, free_delivery_threshold: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Orders above this amount get free standard delivery.</p>
            </div>

            <div>
              <Label htmlFor="std_fee" className="text-xs font-semibold">Standard Delivery Fee (₹)</Label>
              <Input
                id="std_fee"
                type="number"
                value={String(formData.default_delivery_fee)}
                onChange={(e) => setFormData({ ...formData, default_delivery_fee: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Charged for orders below the free threshold.</p>
            </div>

            <div>
              <Label htmlFor="exp_fee" className="text-xs font-semibold">Express 60-Min Delivery Fee (₹)</Label>
              <Input
                id="exp_fee"
                type="number"
                value={String(formData.express_delivery_fee)}
                onChange={(e) => setFormData({ ...formData, express_delivery_fee: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Priority rider surcharge for express dispatch.</p>
            </div>

            
          </div>
        </Container>

        {/* Operational Time Buffers */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Clock className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Kitchen Preparation Buffers
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prep_mins" className="text-xs font-semibold">Default Cake Baking Buffer (Mins)</Label>
              <Input
                id="prep_mins"
                type="number"
                value={String(formData.default_prep_time_mins)}
                onChange={(e) => setFormData({ ...formData, default_prep_time_mins: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Standard preparation time for standard cakes.</p>
            </div>

            <div>
              <Label htmlFor="slot_duration" className="text-xs font-semibold">Delivery Slot Window (Mins)</Label>
              <Input
                id="slot_duration"
                type="number"
                value={String(formData.default_slot_duration_mins)}
                onChange={(e) => setFormData({ ...formData, default_slot_duration_mins: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Customer slot selection interval (e.g. 60 mins).</p>
            </div>
          </div>
        </Container>
      </div>
    </form>
  );
}
