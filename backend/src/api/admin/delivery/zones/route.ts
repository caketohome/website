import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;
  const zones = await deliveryModuleService.listDeliveryZones({}, {
    order: { pincode: "ASC" },
  });
  return res.status(200).json({ delivery_zones: zones });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { pincode, branch_id, delivery_fee, is_serviceable } = req.body as any;
  if (!pincode || !branch_id) {
    return res.status(400).json({ message: "pincode and branch_id are required" });
  }

  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;
  
  // Check if exists
  const existing = await deliveryModuleService.listDeliveryZones({ pincode });
  let zone;
  if (existing.length > 0) {
    zone = await deliveryModuleService.updateDeliveryZones({
      id: existing[0].id,
      branch_id,
      delivery_fee,
      is_serviceable,
    });
  } else {
    zone = await deliveryModuleService.createDeliveryZones({
      pincode,
      branch_id,
      delivery_fee,
      is_serviceable,
    });
  }

  return res.status(200).json({ delivery_zone: zone });
}
