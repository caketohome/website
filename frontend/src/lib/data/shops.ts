/**
 * CakeToHome Storefront Shops & Branches Data Layer
 * Connects branch retrieval to ApiEngine & custom NestJS Core API (/api/v1/branches).
 */

import { ApiEngine } from "../api-engine";
import { ShopDTO } from "../types";

export async function retrieveShop(shopId: string): Promise<ShopDTO> {
  const branch = ApiEngine.resolveBranchRecord(shopId);
  const branchProds = ApiEngine.getBranchProducts(branch?.id || shopId);

  return {
    id: branch?.id || shopId || "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    name: branch?.name || "CakeToHome Indiranagar Flagship",
    description: "Main Bakery Branch & Fulfillment Center",
    handle: branch?.code?.toLowerCase() || "caketohome-indiranagar",
    is_open: branch?.is_open !== false && !branch?.is_paused,
    address: branch?.address || "100 Feet Rd, Indiranagar, Bengaluru",
    phone: branch?.phone || "+91 98765 43210",
    email: branch?.email || "branch@cakes2home.com",
    deliveries: [],
    products: (branchProds.products || []).map((p: any) => ({
      id: p.id,
      title: p.title || p.name,
      description: "Artisanal gourmet cake made fresh daily",
      thumbnail: p.thumbnail,
      categories: [{ id: "cat_bestseller", name: p.category || "Gourmet Cakes" }],
      variants: [
        {
          id: `var_${p.id}`,
          title: "1 kg",
          sku: `SKU_${p.id}`,
          price: { calculated_amount: String(p.price || 599) },
        },
      ],
    })),
  } as any;
}

export async function listShops(filter?: Record<string, string>): Promise<ShopDTO[]> {
  const branches = ApiEngine.listBranches();
  return Promise.all(branches.map((b: any) => retrieveShop(b.id)));
}

export async function retrieveShopByHandle(handle: string): Promise<ShopDTO> {
  const branches = ApiEngine.listBranches();
  const found = branches.find((b: any) => b.code?.toLowerCase() === handle?.toLowerCase() || b.id === handle);
  return retrieveShop(found?.id || "res_01KXYMAHGFPRY1G9TZKEVGAGAT");
}

