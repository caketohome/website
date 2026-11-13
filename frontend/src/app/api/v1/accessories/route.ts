import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";
import { InventoryService } from "@frontend/lib/services/inventory.service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await ApiEngine.ensureHydrated();
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get("branchId") || searchParams.get("branch_id") || undefined;
    const productId = searchParams.get("productId") || undefined;
    const inStockOnly = searchParams.get("in_stock_only") === "true";
    const page = (searchParams.get("page") as any) || "product";

    if (branchId) {
      const items = await InventoryService.getBranchInventoryItems(branchId);
      const filtered = inStockOnly ? items.filter((i: any) => (i.available_stock || 0) > 0) : items;
      return NextResponse.json({
        accessories: filtered,
        items: filtered,
        branch_id: branchId,
        count: filtered.length,
        success: true,
      });
    }

    if (productId) {
      const recommendations = ApiEngine.getRecommendedAccessories(productId, page);
      return NextResponse.json({ accessories: recommendations, success: true });
    }

    const accessories = ApiEngine.listAccessories({ in_stock_only: inStockOnly });
    return NextResponse.json({ accessories, items: accessories, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch accessories" }, { status: 500 });
  }
}
