"use client";

import { ShopDTO } from "@frontend/lib/types";
import { HttpTypes, ProductCategoryDTO } from "@medusajs/types";
import { CreateCategoryDrawer } from "./create-category-drawer";
import { CreateProductDrawer } from "./create-product-drawer";

export function MenuActions({
  shop,
  categories,
}: {
  shop: ShopDTO;
  categories: HttpTypes.StoreProductCategory[];
}) {
  return (
    <div className="flex gap-4">
      <CreateCategoryDrawer shop={shop} />
      <CreateProductDrawer shop={shop} categories={categories} />
    </div>
  );
}
