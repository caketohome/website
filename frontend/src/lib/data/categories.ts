/**
 * CakeToHome Storefront Categories Data Layer
 */

import { apiClient } from "../api-client";

export async function listCategories(): Promise<any[]> {
  return [
    { id: "cat_chocolate", name: "Chocolate Cakes", handle: "chocolate-cakes" },
    { id: "cat_cheesecakes", name: "Gourmet Cheesecakes", handle: "cheesecakes" },
    { id: "cat_photo", name: "Custom Photo Cakes", handle: "photo-cakes" },
  ];
}
