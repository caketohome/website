"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Cake, ShieldAlert, CheckCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

interface BranchProductAvailabilityModalProps {
  branch: any;
  onClose: () => void;
}

export function BranchProductAvailabilityModal({ branch, onClose }: BranchProductAvailabilityModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Search filter
  const [search, setSearch] = useState("");

  useEffect(() => {
    setLoading(true);
    apiClient.getProducts()
      .then((res: any) => setProducts(res?.products || res?.data || []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const handleUpdateAvailability = async (productId: string, status: string, reason: string = "") => {
    setSavingId(productId);
    try {
      await apiClient.updateBranchProductAvailability(branch.id, productId, status, reason);
      // Update local state
      branch.product_availability = {
        ...(branch.product_availability || {}),
        [productId]: { status, reason },
      };
    } catch (err: any) {
      alert(err.message || "Failed to update availability");
    } finally {
      setSavingId(null);
    }
  };

  const handleToggleFulfilment = async (productId: string, currentCanFulfil: boolean, reason: string = "") => {
    setSavingId(productId);
    const newFulfil = !currentCanFulfil;
    try {
      await apiClient.updateBranchCakeFulfilment(branch.id, productId, newFulfil, reason || (newFulfil ? "Resumed Fulfilment" : "Kitchen Stopped Production"));
      branch.cake_fulfilment = {
        ...(branch.cake_fulfilment || {}),
        [productId]: { can_fulfil: newFulfil, reason: reason || (newFulfil ? "Resumed Fulfilment" : "Kitchen Stopped Production") },
      };
    } catch (err: any) {
      alert(err.message || "Failed to update cake fulfilment flag");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = products.filter((p) => (p.name || p.title || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b bg-amber-50/70 dark:bg-amber-950/40 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-bold flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Cake className="w-5 h-5 text-amber-600" /> Branch Product & Cake Availability Manager
            </Heading>
            <Text className="text-xs text-amber-700 dark:text-amber-300">
              Branch: <span className="font-bold">{branch.name}</span> ({branch.code}) • Kitchen Availability & Status Overrides
            </Text>
          </div>
          <Button size="small" variant="transparent" onClick={onClose}>✕ Close</Button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
          {/* Note */}
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 rounded-xl border border-blue-200 text-xs">
            💡 <span className="font-bold">Business Model Note</span>: CakeToHome does not track flour/sugar quantities. We manage <span className="font-bold font-mono">Can Fulfil (YES/NO)</span> flags and branch availability states when kitchens stop production or ingredients are unavailable.
          </div>

          <Input
            placeholder="Filter cake products by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="text-xs"
          />

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Loading branch product list...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">No matching products found.</div>
          ) : (
            <div className="space-y-3">
              {filtered.map((prod) => {
                const avail = (branch.product_availability && branch.product_availability[prod.id]) || { status: "available" };
                const fulfil = (branch.cake_fulfilment && branch.cake_fulfilment[prod.id]) || { can_fulfil: true };
                const isSaving = savingId === prod.id;

                return (
                  <div key={prod.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{prod.name || prod.title}</span>
                        <Badge color={fulfil.can_fulfil ? "green" : "red"} className="text-[10px] font-extrabold">
                          {fulfil.can_fulfil ? "Fulfilment: YES ✅" : "Fulfilment: NO ❌"}
                        </Badge>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Category: {prod.category || "Artisanal Cakes"} • Global Price: ₹{prod.price}
                      </div>
                      {!fulfil.can_fulfil && fulfil.reason && (
                        <div className="text-[10px] text-rose-600 font-medium">
                          Pause Reason: "{fulfil.reason}"
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      {/* Availability Selector */}
                      <select
                        value={avail.status}
                        onChange={(e) => handleUpdateAvailability(prod.id, e.target.value)}
                        disabled={isSaving}
                        className="p-2 text-xs font-semibold rounded-lg border bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                      >
                        <option value="available">Available (Active)</option>
                        <option value="express_available">Express Available</option>
                        <option value="scheduled_only">Scheduled Only</option>
                        <option value="temporarily_hidden">Temporarily Hidden</option>
                        <option value="unavailable">Unavailable</option>
                        <option value="seasonal">Seasonal</option>
                        <option value="coming_soon">Coming Soon</option>
                      </select>

                      {/* Cake Fulfilment Toggle Button */}
                      <Button
                        size="small"
                        variant={fulfil.can_fulfil ? "danger" : "secondary"}
                        isLoading={isSaving}
                        onClick={() => handleToggleFulfilment(prod.id, fulfil.can_fulfil)}
                        className="font-bold text-xs"
                      >
                        {fulfil.can_fulfil ? "Pause Fulfilment" : "Resume Fulfilment"}
                      </Button>
                    </div>
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
