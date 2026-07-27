import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../modules/shop";
import zod from "zod";

const createTransferSchema = zod.object({
  from_branch_id: zod.string().nullable().optional(),
  to_branch_id: zod.string(),
  product_id: zod.string(),
  variant_id: zod.string(),
  quantity: zod.number().positive(),
  created_by: zod.string(),
  status: zod.enum(["pending", "completed", "cancelled"]).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const transfers = await shopModuleService.listInventoryTransfers({}, { relations: ["from_branch", "to_branch"] });
    return res.status(200).json({ transfers });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = createTransferSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const transferResult = await shopModuleService.createInventoryTransfers([validated]);
    const transfer = transferResult[0];

    // If status is immediately completed, run execution logic
    if (validated.status === "completed") {
      await shopModuleService.executeInventoryTransfer(transfer.id);
    }

    return res.status(200).json({ transfer });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
