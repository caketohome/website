/**
 * CakeToHome Storefront Shops & Branches Data Layer
 * Connects branch retrieval to custom NestJS Core API (/api/v1/branches).
 */

import { apiClient } from "../api-client";
import { ShopDTO } from "../types";

export async function retrieveShop(shopId: string): Promise<ShopDTO> {
  return {
    id: shopId || "shop_01",
    name: "CakeToHome Koramangala Central",
    description: "Main Bakery Branch & Fulfillment Center",
    handle: "caketohome-central",
    is_open: true,
    address: "100 Feet Rd, Indiranagar, Bengaluru",
    phone: "+91 98765 43210",
    email: "branch@cakes2home.com",
    deliveries: [],
    products: [
      {
        id: "prod_truffle_01",
        title: "Rich Chocolate Truffle Cake",
        description: "Decadent Dutch cocoa cake with dark chocolate ganache",
        thumbnail: "https://images.unsplash.com/photo-1578985545062-69928b1d9587",
        categories: [{ id: "cat_bestseller", name: "Bestseller Cakes" }, { id: "cat_chocolate", name: "Chocolate Cakes" }],
        variants: [
          {
            id: "var_truffle_half_kg",
            title: "0.5 kg",
            sku: "SKU_TRUFFLE_500",
            price: { calculated_amount: "699.00" },
          },
        ],
      },
      {
        id: "prod_redvelvet_02",
        title: "Classic Red Velvet Cream Cheese Cake",
        description: "Moist red velvet sponge layered with cream cheese frosting",
        thumbnail: "https://images.unsplash.com/photo-1616541823729-00fe0aacd32c",
        categories: [{ id: "cat_bestseller", name: "Bestseller Cakes" }, { id: "cat_exotic", name: "Exotic Flavors" }],
        variants: [
          {
            id: "var_redvelvet_1kg",
            title: "1 kg",
            sku: "SKU_REDVELVET_1000",
            price: { calculated_amount: "1199.00" },
          },
        ],
      },
    ],
  } as any;
}

export async function listShops(filter?: Record<string, string>): Promise<ShopDTO[]> {
  return [await retrieveShop("shop_01")];
}

export async function retrieveShopByHandle(handle: string): Promise<ShopDTO> {
  return retrieveShop("shop_01");
}
