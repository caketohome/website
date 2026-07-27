import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../../modules/shop";
import zod from "zod";

const querySchema = zod.object({
  variant_id: zod.string(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validatedQuery = querySchema.safeParse(req.query);
  if (!validatedQuery.success) {
    return res.status(400).json({ message: "Missing 'variant_id' query parameter." });
  }

  const { variant_id } = validatedQuery.data;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;

  try {
    const priceOverride = await shopModuleService.getBranchPrice(branchId, variant_id);
    return res.status(200).json({ price: priceOverride });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
