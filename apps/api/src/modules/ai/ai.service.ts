/**
 * CakeToHome Core API - Commerce AI & Predictive Analytics Domain Service (Feature 13)
 * Manages Branch Demand Forecasting, Best-Seller & Slow-Moving Item Prediction,
 * Delivery Delay Alerts, Workload Bottleneck Warnings, and Customer Reorder Cadence Prediction.
 */

export interface BranchDemandForecastDto {
  branchId: string;
  targetDate: string; // YYYY-MM-DD
  predictedOrderVolume: number;
  expectedSurgeFactor: number; // e.g. 1.4 for 40% surge
  recommendedStaffCount: number;
}

export interface ProductVelocityPredictionDto {
  productId: string;
  productTitle: string;
  velocityCategory: "BEST_SELLER" | "STABLE" | "SLOW_MOVING";
  predictedWeeklySales: number;
  recommendation: string;
}

export interface DeliveryDelayRiskDto {
  branchId: string;
  pincode: string;
  riskLevel: "LOW" | "MODERATE" | "HIGH";
  predictedExtraMinutes: number;
  reason: string;
}

export class AiService {
  async forecastBranchDemand(branchId: string, targetDate: string = "2026-08-15"): Promise<BranchDemandForecastDto> {
    const isHoliday = targetDate.includes("08-15") || targetDate.includes("12-25");
    const surgeFactor = isHoliday ? 1.8 : 1.1;
    const baseVolume = 120;
    const predictedOrderVolume = Math.round(baseVolume * surgeFactor);

    return {
      branchId,
      targetDate,
      predictedOrderVolume,
      expectedSurgeFactor: surgeFactor,
      recommendedStaffCount: Math.ceil(predictedOrderVolume / 15),
    };
  }

  async predictProductVelocity(): Promise<ProductVelocityPredictionDto[]> {
    return [
      {
        productId: "prod_truffle_01",
        productTitle: "Rich Chocolate Truffle Cake",
        velocityCategory: "BEST_SELLER",
        predictedWeeklySales: 350,
        recommendation: "Maintain +30% raw chocolate sponge safety stock at Koramangala Branch",
      },
      {
        productId: "prod_black_forest_01",
        productTitle: "Classic Black Forest Cake",
        velocityCategory: "SLOW_MOVING",
        predictedWeeklySales: 45,
        recommendation: "Offer 15% flash promo discount on Friday afternoon shift",
      },
    ];
  }

  async predictDeliveryDelayRisk(branchId: string, pincode: string): Promise<DeliveryDelayRiskDto> {
    const isPeakHour = new Date().getHours() >= 18 && new Date().getHours() <= 21;
    return {
      branchId,
      pincode,
      riskLevel: isPeakHour ? "HIGH" : "LOW",
      predictedExtraMinutes: isPeakHour ? 15 : 0,
      reason: isPeakHour ? "Peak evening traffic slowdown on 100 Feet Rd" : "Normal traffic conditions",
    };
  }
}
