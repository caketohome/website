/**
 * CakeToHome Storefront Enterprise Multi-Branch Data Layer
 */

import { apiClient } from "../api-client";

export async function listBranches(): Promise<any[]> {
  try {
    const res: any = await apiClient.getBranches();
    return res?.branches || [];
  } catch (err: any) {
    throw new Error(`Failed to retrieve branches from PostgreSQL: ${err?.message || 'Database error'}`);
  }
}

export async function retrieveNearestBranch(lat?: number, lng?: number, pincode?: string, areaName?: string): Promise<any | null> {
  try {
    const res: any = await apiClient.resolveBranch({ lat, lng, pincode, area: areaName });
    return res?.branch || null;
  } catch {
    return null;
  }
}

export async function retrieveBranchInventory(branchId: string, variantId: string, productId?: string): Promise<{ availableStock: number | null; isAvailable: boolean }> {
  try {
    const res: any = await apiClient.getBranches();
    const branch = (res?.branches || []).find((b: any) => b.id === branchId);
    if (!branch) return { availableStock: 0, isAvailable: false };

    const targetId = productId || variantId;
    // Check if target is an accessory or stock-controlled product
    const isAccessory = targetId.startsWith("acc_") || targetId.includes("candle") || targetId.includes("topper") || targetId.includes("card") || targetId.includes("balloon");

    if (isAccessory) {
      try {
        const accRes: any = await apiClient.getAccessories({ branchId });
        const accessories = accRes?.accessories || [];
        const item = accessories.find((a: any) => a.id === targetId || a.sku === targetId || a.variant_id === targetId);
        if (item) {
          const avail = Number(item.available_stock !== undefined ? item.available_stock : (item.stock ?? 0));
          return { availableStock: avail, isAvailable: avail > 0 };
        }
      } catch (accErr) {
        console.warn("[retrieveBranchInventory] Failed to fetch accessory stock:", accErr);
      }
      return { availableStock: 0, isAvailable: false };
    }

    // Made-to-order cakes do not have artificial integer stock
    const availability = branch?.metadata?.product_availability || branch?.product_availability || {};
    const override = availability[targetId];
    const status = (override?.status || (override?.is_available === false ? "UNAVAILABLE" : "") || "").toUpperCase();
    const canFulfil = branch?.metadata?.cake_fulfilment?.[targetId]?.can_fulfil ?? branch?.cake_fulfilment?.[targetId]?.can_fulfil ?? (branch?.metadata?.cake_fulfilment?.can_fulfil ?? branch?.cake_fulfilment?.can_fulfil ?? true);
    const isUnavailable = status === "OUT_OF_STOCK" || status === "UNAVAILABLE" || status === "OUT_TODAY" || status === "HIDDEN" || status === "OFF" || !canFulfil;

    return { availableStock: null, isAvailable: !isUnavailable };
  } catch {
    return { availableStock: 0, isAvailable: false };
  }
}

export async function retrieveBranchPricing(branchId: string, variantId: string): Promise<any> {
  throw new Error("Branch pricing must be retrieved via authoritative product catalog API");
}
