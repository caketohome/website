/**
 * CakeToHome Storefront Branches Data Layer
 */

import { apiClient } from "../api-client";

export async function listBranches(): Promise<any[]> {
  return [{ id: "br_koramangala", name: "Koramangala Central", pincode: "560038" }];
}

export async function retrieveNearestBranch(lat: number, lng: number): Promise<any | null> {
  return { id: "br_koramangala", name: "Koramangala Central", pincode: "560038" };
}

export async function retrieveBranchInventory(branchId: string, variantId: string): Promise<any> {
  return { availableStock: 43 };
}

export async function retrieveBranchPricing(branchId: string, variantId: string): Promise<any> {
  return { price: "699.00" };
}
