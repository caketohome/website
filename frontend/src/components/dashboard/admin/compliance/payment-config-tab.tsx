"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { CreditCard, Save, CheckCircle2, DollarSign, Lock, HelpCircle } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export function PaymentConfigTab({
  paymentSettings,
  onUpdated,
}: {
  paymentSettings: any;
  onUpdated: (updated: any) => void;
}) {
  const [formData, setFormData] = useState({
    supported_methods: paymentSettings?.supported_methods || ["cod", "razorpay", "test_mode", "wallet"],
    razorpay_key_id: paymentSettings?.razorpay_key_id || "rzp_test_placeholder_key",
    cod_max_limit: paymentSettings?.cod_max_limit ?? 5000,
    cod_surcharge: paymentSettings?.cod_surcharge ?? 0,
    default_currency: paymentSettings?.default_currency || "INR",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const toggleMethod = (method: "cod" | "razorpay" | "wallet" | "test_mode") => {
    setFormData((prev) => {
      const exists = prev.supported_methods.includes(method);
      return {
        ...prev,
        supported_methods: exists
          ? prev.supported_methods.filter((m: string) => m !== method)
          : [...prev.supported_methods, method],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    try {
      const res: any = await apiClient.updatePaymentSettings(formData);
      const updated = res?.payments || res?.data || formData;
      onUpdated(updated);
      setSuccessMsg("Payment Configuration settings updated successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      alert("Failed to save payment settings: " + (err.message || "Unknown error"));
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
            <CreditCard className="w-5 h-5 text-amber-600" />
            <Heading level="h3" className="text-base font-bold">Payment Methods & Gateway Settings</Heading>
          </div>
          <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure customer checkout payment options, COD threshold limits, and Razorpay integration keys.
          </Text>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shrink-0"
        >
          <Save className="w-4 h-4" /> Save Payment Config
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Supported Payment Channels */}
        <Container className="p-5 flex flex-col gap-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Enabled Payment Methods
          </Text>

          <div className="flex flex-col gap-3">
            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Cash on Delivery (COD)</span>
                <p className="text-xs text-slate-500">Pay cash or UPI upon doorstep delivery</p>
              </div>
              <input
                type="checkbox"
                checked={formData.supported_methods.includes("cod")}
                onChange={() => toggleMethod("cod")}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Razorpay Online Gateway</span>
                <p className="text-xs text-slate-500">UPI, Credit/Debit Cards, Netbanking & Wallets</p>
              </div>
              <input
                type="checkbox"
                checked={formData.supported_methods.includes("razorpay")}
                onChange={() => toggleMethod("razorpay")}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">CakeToHome Customer Wallet</span>
                <p className="text-xs text-slate-500">Instant checkout using stored wallet balance</p>
              </div>
              <input
                type="checkbox"
                checked={formData.supported_methods.includes("wallet")}
                onChange={() => toggleMethod("wallet")}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50/50 cursor-pointer">
              <div>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Direct Sandbox / Test Mode</span>
                <p className="text-xs text-slate-500">Simulate instant payments for testing and automated pipelines</p>
              </div>
              <input
                type="checkbox"
                checked={formData.supported_methods.includes("test_mode")}
                onChange={() => toggleMethod("test_mode")}
                className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>
          </div>
        </Container>

        {/* COD Limits & Razorpay Credentials */}
        <Container className="p-5 flex flex-col gap-4">
          <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Rules & Gateway Credentials
          </Text>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="cod_limit" className="text-xs font-semibold">Maximum COD Order Limit (₹)</Label>
              <Input
                id="cod_limit"
                type="number"
                value={String(formData.cod_max_limit)}
                onChange={(e) => setFormData({ ...formData, cod_max_limit: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Orders above this value require online payment.</p>
            </div>

            <div>
              <Label htmlFor="cod_fee" className="text-xs font-semibold">COD Handling Fee / Surcharge (₹)</Label>
              <Input
                id="cod_fee"
                type="number"
                value={String(formData.cod_surcharge)}
                onChange={(e) => setFormData({ ...formData, cod_surcharge: Number(e.target.value) || 0 })}
                className="mt-1"
              />
              <p className="text-[11px] text-slate-400 mt-1">Extra fee charged when customer selects COD.</p>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="rzp_key" className="text-xs font-semibold">Razorpay Key ID (Public)</Label>
              <Input
                id="rzp_key"
                value={formData.razorpay_key_id}
                onChange={(e) => setFormData({ ...formData, razorpay_key_id: e.target.value })}
                className="mt-1 font-mono"
              />
              <p className="text-[11px] text-slate-400 mt-1">Secret Key is securely stored in environment variables.</p>
            </div>
          </div>
        </Container>
      </div>
    </form>
  );
}
