import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../modules/shop";
import zod from "zod";

const updateTransferSchema = zod.object({
  status: zod.enum(["pending", "shipped", "completed", "cancelled"]),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const transferId = req.params.id;
  const validated = updateTransferSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const [existing] = await shopModuleService.listInventoryTransfers({ id: transferId });
    if (!existing) {
      return res.status(404).json({ message: "Transfer not found" });
    }

    if (validated.status === "completed" && existing.status !== "completed") {
      // Execute the transfer (updates inventory)
      await shopModuleService.executeInventoryTransfer(transferId);
    } else {
      await shopModuleService.updateInventoryTransfers({
        selector: { id: transferId },
        data: { status: validated.status },
      });
    }

    const [updated] = await shopModuleService.listInventoryTransfers({ id: transferId }, { relations: ["from_branch", "to_branch"] });
    return res.status(200).json({ transfer: updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
