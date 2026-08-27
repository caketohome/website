import { NextRequest, NextResponse } from "next/server";
import { ApiEngine } from "@frontend/lib/api-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || undefined;
    const page = (searchParams.get("page") as any) || "product";

    if (productId) {
      const recommendations = ApiEngine.getRecommendedAccessories(productId, page);
      return NextResponse.json({ accessories: recommendations, success: true });
    }

    const accessories = ApiEngine.listAccessories({ in_stock_only: true });
    return NextResponse.json({ accessories, success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch accessories" }, { status: 500 });
  }
}
