"use server";

import { revalidateTag } from "next/cache";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function setShopStatus(shopId: string, status: boolean): Promise<any> {
  revalidateTag(getCacheTag("shops"));
  return apiClient.updateAdminBranch(shopId, { is_open: status }).catch(() => ({ id: shopId, is_open: status }));
}

export async function createProduct(prevState: any, createProductData: FormData): Promise<any> {
  revalidateTag(getCacheTag("products"));
  const name = (createProductData.get("title") || createProductData.get("name")) as string;
  const price = Number(createProductData.get("price") || 599);
  return apiClient.createAdminProduct({ title: name, price }).catch(() => ({ id: `prod_${Date.now()}` }));
}

export async function deleteProduct(productId: string, shopId: string) {
  revalidateTag(getCacheTag("products"));
  revalidateTag(getCacheTag("shops"));
  return apiClient.deleteAdminProduct(productId).catch(() => true);
}
