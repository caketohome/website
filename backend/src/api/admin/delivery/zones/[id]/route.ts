import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const deliveryModuleService = req.scope.resolve("deliveryModuleService");
  await deliveryModuleService.deleteDeliveryZones(id);
  return res.status(200).json({ message: "Delivery zone deleted successfully", id });
}
