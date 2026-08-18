"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { MapPin, ShieldAlert, CheckCircle, Search, RefreshCw, X, AlertOctagon, Filter } from "lucide-react";

interface BranchZoneProductRestrictionsModalProps {
  branch: any;
  userRole?: string;
  userBranchId?: string;
  onClose: () => void;
}

export function BranchZoneProductRestrictionsModal({
  branch,
  userRole = "SUPER_ADMIN",
  userBranchId,
  onClose,
}: BranchZoneProductRestrictionsModalProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [reasonMap, setReasonMap] = useState<Record<string, string>>({});
  const [savingZoneId, setSavingZoneId] = useState<string | null>(null);

  const zones: any[] = Array.isArray(branch?.delivery_zones) ? branch.delivery_zones : [];
  const isBranchManager = userRole === "BRANCH_MANAGER";
  const isAuthorizedBranch = !isBranchManager || (userBranchId && userBranchId === branch.id);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getProducts().catch(() => ({ products: [] })),
      apiClient.getProductDeliveryRestrictions({ branch_id: branch.id }).catch(() => ({ restrictions: [] })),
    ])
      .then(([prodRes, restRes]) => {
        const prodList = prodRes?.products || prodRes?.data || [];
        setProducts(prodList);
        if (prodList.length > 0 && !selectedProductId) {
          setSelectedProductId(prodList[0].id || prodList[0].product_id);
        }
        setRestrictions(restRes?.restrictions || []);
      })
      .finally(() => setLoading(false));
  }, [branch.id]);

  const selectedProduct = products.find((p) => (p.id || p.product_id) === selectedProductId) || products[0];

  const getRestrictionState = (zoneId: string) => {
    if (!selectedProductId || !branch?.id) return null;
    return restrictions.find(
      (r) => r.product_id === selectedProductId && r.branch_id === branch.id && r.zone_id === zoneId
    );
  };

  const handleToggleRestriction = async (zoneId: string, currentIsRestricted: boolean) => {
    if (!isAuthorizedBranch) {
      alert("Unauthorized: Branch Managers can only modify delivery restrictions for their assigned branch.");
      return;
    }
    setSavingZoneId(zoneId);
    const newRestricted = !currentIsRestricted;
    const reason = reasonMap[zoneId] || (newRestricted ? "Restricted for zone delivery" : "Available for delivery");

    try {
      const res = await apiClient.updateProductDeliveryRestriction({
        product_id: selectedProductId,
        branch_id: branch.id,
        zone_id: zoneId,
        is_restricted: newRestricted,
        reason,
      });

      if (res?.restriction) {
        setRestrictions((prev) => {
          const idx = prev.findIndex(
            (r) => r.product_id === selectedProductId && r.branch_id === branch.id && r.zone_id === zoneId
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.restriction;
            return next;
          }
          return [...prev, res.restriction];
        });
      }
    } catch (err: any) {
      alert(err.message || "Failed to update delivery restriction");
    } finally {
      setSavingZoneId(null);
    }
  };

  const handleBulkToggle = async (restrictAll: boolean) => {
    if (!isAuthorizedBranch) {
      alert("Unauthorized: Branch Managers can only modify delivery restrictions for their assigned branch.");
      return;
    }
    if (!selectedProductId) return;
    setLoading(true);
    try {
      const bulkPayload = zones.map((z) => ({
        product_id: selectedProductId,
        branch_id: branch.id,
        zone_id: z.id,
        is_restricted: restrictAll,
        reason: restrictAll ? "Bulk restricted all zones" : "Bulk unrestricted all zones",
      }));
      const res = await apiClient.bulkUpdateProductDeliveryRestrictions(bulkPayload);
      if (res?.restrictions) {
        setRestrictions((prev) => {
          const other = prev.filter(
            (r) => !(r.product_id === selectedProductId && r.branch_id === branch.id)
          );
          return [...other, ...res.restrictions];
        });
      }
    } catch (err: any) {
      alert(err.message || "Bulk update failed");
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter((p) =>
    (p.name || p.title || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b bg-rose-50/70 dark:bg-rose-950/40 flex items-center justify-between">
          <div>
            <Heading level="h3" className="text-base font-bold flex items-center gap-2 text-rose-900 dark:text-rose-200">
              <ShieldAlert className="w-5 h-5 text-rose-600" /> Zone Delivery Restrictions Manager
            </Heading>
            <Text className="text-xs text-rose-700 dark:text-rose-300">
              Store: <span className="font-bold">{branch.name}</span> ({branch.code}) • Scoped Product Delivery Rules
            </Text>
          </div>
          <Button size="small" variant="transparent" onClick={onClose}>
            <X className="w-4 h-4" /> Close
          </Button>
        </div>

        {/* Security Alert Banner */}
        {!isAuthorizedBranch && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/50 border-b border-amber-200 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Read-Only View: You are assigned to another branch and cannot modify restrictions for {branch.name}.</span>
          </div>
        )}

        {/* Content Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800 max-h-[70vh] overflow-hidden">
          {/* Left Column: Product Selection */}
          <div className="p-4 space-y-3 flex flex-col overflow-y-auto border-r border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-xs text-slate-700 dark:text-slate-300">Select Product ({filteredProducts.length})</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <Input
                placeholder="Search cakes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 text-xs h-8"
              />
            </div>
            <div className="space-y-1 overflow-y-auto flex-1 pr-1">
              {filteredProducts.map((p) => {
                const pId = p.id || p.product_id;
                const isSelected = pId === selectedProductId;
                const activeRestrictions = restrictions.filter(
                  (r) => r.product_id === pId && r.branch_id === branch.id && r.is_restricted
                );
                return (
                  <button
                    key={pId}
                    onClick={() => setSelectedProductId(pId)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition flex items-center justify-between ${
                      isSelected
                        ? "bg-rose-600 text-white font-medium shadow"
                        : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate pr-2">{p.name || p.title}</span>
                    {activeRestrictions.length > 0 && (
                      <Badge color="red" className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0">
                        {activeRestrictions.length} Restricted
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Zone Restrictions Control */}
          <div className="col-span-2 p-5 space-y-4 overflow-y-auto flex flex-col">
            {selectedProduct ? (
              <>
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div>
                    <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      {selectedProduct.name || selectedProduct.title}
                    </Heading>
                    <Text className="text-xs text-slate-500">
                      Configure delivery zone serviceability for this specific cake under {branch.name}.
                    </Text>
                  </div>
                  {isAuthorizedBranch && (
                    <div className="flex items-center gap-2">
                      <Button size="small" variant="secondary" onClick={() => handleBulkToggle(true)} disabled={loading}>
                        Restrict All
                      </Button>
                      <Button size="small" variant="transparent" onClick={() => handleBulkToggle(false)} disabled={loading}>
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>

                {zones.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-400 border border-dashed rounded-xl">
                    No delivery zones configured for this branch yet.
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 overflow-y-auto">
                    {zones.map((z: any) => {
                      const rRecord = getRestrictionState(z.id);
                      const isRestricted = Boolean(rRecord && rRecord.is_restricted);
                      const isSaving = savingZoneId === z.id;

                      // Branch-level availability check for visual distinction
                      const branchAvail = (branch.product_availability && branch.product_availability[selectedProductId]) || { status: "available" };
                      const branchStatus = (branchAvail.status || "available").toUpperCase();

                      return (
                        <div
                          key={z.id}
                          className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                            isRestricted
                              ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800"
                              : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-slate-500" />
                              <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{z.name}</span>
                              <span className="text-[10px] text-slate-500 font-mono">({z.min_km}-{z.max_km} KM)</span>
                            </div>

                            <div className="flex items-center gap-2 text-[11px]">
                              {/* Distinction Badges */}
                              {branchStatus === "OUT_OF_STOCK" && (
                                <Badge color="red" className="text-[10px] font-bold">STORE OUT OF STOCK</Badge>
                              )}
                              {branchStatus === "HIDDEN" && (
                                <Badge color="grey" className="text-[10px] font-bold">STORE HIDDEN</Badge>
                              )}

                              {/* Zone Delivery Restriction Status */}
                              {isRestricted ? (
                                <span className="inline-flex items-center gap-1 font-bold text-rose-700 dark:text-rose-400">
                                  <ShieldAlert className="w-3.5 h-3.5" /> DELIVERY RESTRICTED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                                  <CheckCircle className="w-3.5 h-3.5" /> AVAILABLE FOR DELIVERY
                                </span>
                              )}
                            </div>

                            {rRecord?.reason && (
                              <p className="text-[10px] text-slate-500 italic">Reason: {rRecord.reason}</p>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {isAuthorizedBranch && (
                              <Button
                                size="small"
                                variant={isRestricted ? "secondary" : "danger"}
                                onClick={() => handleToggleRestriction(z.id, isRestricted)}
                                disabled={isSaving}
                                className="text-xs"
                              >
                                {isSaving ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : isRestricted ? (
                                  "Make Available"
                                ) : (
                                  "Restrict Delivery"
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <div className="p-12 text-center text-xs text-slate-400">Please select a product from the list.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
