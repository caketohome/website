import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";
import zod from "zod";

const applyCouponSchema = zod.object({
  appliedCoupons: zod.array(zod.string()).optional().default([]),
  coupon: zod.string().min(1, "Coupon code is required"),
});

/**
 * POST /store/coupons/apply
 * Validates coupon stacking exclusions and eligibility before applying to cart.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = applyCouponSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid coupon payload",
      errors: parsed.error.format(),
    });
  }

  const { appliedCoupons, coupon } = parsed.data;
  const marketingService = req.scope.resolve(MARKETING_MODULE) as any;

  try {
    const validation = await marketingService.validateCouponStacking(appliedCoupons, coupon);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.reason,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Coupon "${coupon}" validated successfully.`,
      coupon: coupon.toUpperCase().trim(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to validate coupon stacking",
    });
  }
}
