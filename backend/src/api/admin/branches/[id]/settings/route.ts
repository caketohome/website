import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../../modules/shop";
import zod from "zod";

const settingsSchema = zod.object({
  delivery_radius_km: zod.number().optional(),
  min_order_amount: zod.number().optional(),
  free_delivery_threshold: zod.number().nullable().optional(),
  auto_allocation_enabled: zod.boolean().optional(),
  allow_pickup: zod.boolean().optional(),
  allow_delivery: zod.boolean().optional(),
  metadata: zod.record(zod.string(), zod.any()).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const [settings] = await shopModuleService.listBranchSettings({ branch_id: branchId });
    return res.status(200).json({ settings: settings || null });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validated = settingsSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const [existing] = await shopModuleService.listBranchSettings({ branch_id: branchId });
    let settings;
    if (existing) {
      settings = await shopModuleService.updateBranchSettings({
        selector: { id: existing.id as string },
        data: validated,
      });
      settings = settings[0];
    } else {
      settings = await shopModuleService.createBranchSettings([
        {
          branch_id: branchId,
          ...validated,
        },
      ]);
      settings = settings[0];
    }
    return res.status(200).json({ settings });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
