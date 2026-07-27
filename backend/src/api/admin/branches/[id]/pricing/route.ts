import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../../modules/shop";
import zod from "zod";

const pricingSchema = zod.object({
  variant_id: zod.string(),
  price: zod.number().positive(),
  compare_at_price: zod.number().nullable().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const pricing = await shopModuleService.listBranchPrices({ branch_id: branchId });
    return res.status(200).json({ pricing });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validated = pricingSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const [existing] = await shopModuleService.listBranchPrices({
      branch_id: branchId,
      variant_id: validated.variant_id,
    });

    let price;
    if (existing) {
      price = await shopModuleService.updateBranchPrices({
        selector: { id: existing.id as string },
        data: {
          price: validated.price,
          compare_at_price: validated.compare_at_price ?? existing.compare_at_price,
        },
      });
      price = price[0];
    } else {
      price = await shopModuleService.createBranchPrices([
        {
          branch_id: branchId,
          ...validated,
        },
      ]);
      price = price[0];
    }
    return res.status(200).json({ price });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
