import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const pincode = req.query.pincode as string;
  if (!pincode) {
    return res.status(400).json({ message: "Pincode query parameter is required" });
  }

  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;
  const zones = await deliveryModuleService.listDeliveryZones({ pincode });

  if (zones.length === 0) {
    return res.status(200).json({
      serviceable: false,
      delivery_fee: 0,
      branch_id: null,
      message: "Delivery not available for this pincode",
    });
  }

  const zone = zones[0];
  return res.status(200).json({
    serviceable: zone.is_serviceable,
    delivery_fee: zone.delivery_fee,
    branch_id: zone.branch_id,
  });
}
