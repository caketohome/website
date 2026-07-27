import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../modules/shop";
import zod from "zod";

const updateSchema = zod.object({
  name: zod.string().optional(),
  code: zod.string().optional(),
  is_open: zod.boolean().optional(),
  phone: zod.string().optional(),
  email: zod.string().email().optional(),
  address: zod.string().optional(),
  latitude: zod.number().optional(),
  longitude: zod.number().optional(),
  city_id: zod.string().optional(),
  region_id: zod.string().optional(),
  metadata: zod.record(zod.string(), zod.any()).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const branch = await shopModuleService.retrieveBranch(branchId, { relations: ["city", "region", "settings"] });
    return res.status(200).json({ branch });
  } catch (error: any) {
    return res.status(404).json({ message: "Branch not found" });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validated = updateSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const branch = await shopModuleService.updateBranches({
      selector: { id: branchId },
      data: validated,
    });
    return res.status(200).json({ branch: branch[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;

  try {
    if (deliveryModuleService) {
      const activeDeliveries = await deliveryModuleService.listDeliveries({
        branch_id: branchId,
        delivery_status: ["assigned", "claimed", "picked_up", "out_for_delivery"],
      }).catch(() => []);

      if (activeDeliveries && activeDeliveries.length > 0) {
        return res.status(409).json({
          message: `Cannot delete branch "${branchId}". There are ${activeDeliveries.length} active pending deliveries assigned to this hub.`,
        });
      }
    }

    await shopModuleService.deleteBranches([branchId]);
    return res.status(200).json({ message: "Branch deleted" });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
