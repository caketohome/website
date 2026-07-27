"use server";

import { ShopDTO, ShopProductDTO } from "@frontend/lib/types";
import { revalidateTag } from "next/cache";
import { apiClient } from "../api-client";
import { getCacheTag } from "../data/cookies";

export async function setShopStatus(shopId: string, status: boolean): Promise<any> {
  revalidateTag(getCacheTag("shops"));
  return { id: shopId, is_open: status };
}

export async function createProduct(prevState: any, createProductData: FormData): Promise<any> {
  revalidateTag(getCacheTag("products"));
  return { id: `prod_${Date.now()}` };
}

export async function deleteProduct(productId: string, shopId: string) {
  revalidateTag(getCacheTag("products"));
  revalidateTag(getCacheTag("shops"));
  return true;
}
