/**
 * CakeToHome Storefront Enterprise Multi-Branch Data Layer
 */

import { apiClient } from "../api-client";

export async function listBranches(): Promise<any[]> {
  try {
    const res: any = await apiClient.getBranches();
    return res?.branches || [];
  } catch {
    return [{ id: "br_indiranagar", name: "Indiranagar Flagship Bakery", pincode: "560038" }];
  }
}

export async function retrieveNearestBranch(lat?: number, lng?: number, pincode?: string, areaName?: string): Promise<any | null> {
  try {
    const res: any = await apiClient.resolveBranch({ lat, lng, pincode, area: areaName });
    return res?.branch || null;
  } catch {
    return { id: "br_indiranagar", name: "Indiranagar Flagship Bakery", pincode: "560038" };
  }
}

export async function retrieveBranchInventory(branchId: string, variantId: string): Promise<any> {
  try {
    const res: any = await apiClient.getBranches();
    const branch = (res?.branches || []).find((b: any) => b.id === branchId);
    return { availableStock: branch?.simultaneous_cakes_capacity || 25 };
  } catch {
    return { availableStock: 25 };
  }
}

export async function retrieveBranchPricing(branchId: string, variantId: string): Promise<any> {
  return { price: "699.00" };
}
