import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../../modules/shop";
import zod from "zod";

const inventorySchema = zod.object({
  product_id: zod.string(),
  variant_id: zod.string(),
  quantity: zod.number(),
  reserved: zod.number().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const inventories = await shopModuleService.listBranchInventories({ branch_id: branchId });
    return res.status(200).json({ inventories });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validated = inventorySchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const [existing] = await shopModuleService.listBranchInventories({
      branch_id: branchId,
      variant_id: validated.variant_id,
    });

    let inventory;
    if (existing) {
      inventory = await shopModuleService.updateBranchInventories({
        selector: { id: existing.id as string },
        data: {
          quantity: validated.quantity,
          reserved: validated.reserved ?? existing.reserved,
        },
      });
      inventory = inventory[0];
    } else {
      inventory = await shopModuleService.createBranchInventories([
        {
          branch_id: branchId,
          ...validated,
        },
      ]);
      inventory = inventory[0];
    }
    return res.status(200).json({ inventory });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
