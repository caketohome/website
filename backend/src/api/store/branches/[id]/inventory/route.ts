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
    const [inv] = await shopModuleService.listBranchInventories({
      branch_id: branchId,
      variant_id,
    });

    if (!inv) {
      return res.status(200).json({ quantity: 0, reserved: 0, available: 0 });
    }

    const available = Math.max(0, (inv.quantity as number) - (inv.reserved as number));
    return res.status(200).json({
      quantity: inv.quantity,
      reserved: inv.reserved,
      available,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
