/**
 * CakeToHome Core API - Coupons, Promotions, & Loyalty Wallet Engine
 * Handles Promo Code Validation, Wallet Deductions, and Loyalty Points.
 */

export class CouponsService {
  private activeCoupons: Map<string, { code: string; discountPercent: number; maxDiscount: number }> = new Map();

  constructor() {
    this.activeCoupons.set("CAKE50", { code: "CAKE50", discountPercent: 15, maxDiscount: 100 });
    this.activeCoupons.set("WELCOME100", { code: "WELCOME100", discountPercent: 20, maxDiscount: 150 });
  }

  async validateCoupon(code: string, subtotalAmount: number): Promise<{ valid: boolean; discountAmount: string }> {
    const coupon = this.activeCoupons.get(code.toUpperCase());
    if (!coupon) {
      throw new Error(`Invalid or expired coupon code: ${code}`);
    }

    const rawDiscount = (subtotalAmount * coupon.discountPercent) / 100;
    const discount = Math.min(rawDiscount, coupon.maxDiscount).toFixed(2);

    return { valid: true, discountAmount: discount };
  }
}
