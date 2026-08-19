import { NextRequest, NextResponse } from "next/server";
import { AiToolRegistry } from "@frontend/lib/ai/ai-tool-registry";
import { AiOrchestrator } from "@frontend/lib/ai/ai-orchestrator";

export async function GET(req: NextRequest) {
  try {
    await AiOrchestrator.ensureInitialized();

    const [occasionsRes, categoriesRes, offersRes, citiesRes] = await Promise.all([
      AiToolRegistry.getOccasions(),
      AiToolRegistry.getCategories(),
      AiToolRegistry.listOffers(),
      AiToolRegistry.getCities(),
    ]);

    const chips = [
      ...occasionsRes.occasions.slice(0, 3).map((o) => `${o.icon || "🎂"} ${o.name} Cakes`),
      "🍫 Top Chocolate Cakes",
      "💰 Cakes Under ₹600",
      "🍓 Fresh Fruit Cakes",
      "🏷️ Active Coupons",
      "🛵 Check Delivery Time",
    ];

    return NextResponse.json({
      success: true,
      quickChips: chips,
      occasions: occasionsRes.occasions,
      categories: categoriesRes.categories,
      offers: offersRes.offers,
      cities: citiesRes.cities,
    });
  } catch (err: any) {
    console.error("AI Context route error:", err);
    return NextResponse.json({
      success: true,
      quickChips: [
        "🎂 Birthday Celebration",
        "💖 Anniversary / Romantic",
        "🍫 Top Chocolate Cakes",
        "💰 Cakes Under ₹600",
        "🛵 Check Delivery Time",
      ],
    });
  }
}
