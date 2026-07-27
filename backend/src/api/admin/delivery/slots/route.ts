import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const deliveryModuleService = req.scope.resolve("deliveryModuleService");
  const slots = await deliveryModuleService.listDeliverySlots({}, {
    order: { start_time: "ASC" },
  });
  return res.status(200).json({ delivery_slots: slots });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { branch_id, slot_name, start_time, end_time, max_capacity, extra_charge } = req.body as any;
  if (!branch_id || !slot_name || !start_time || !end_time) {
    return res.status(400).json({ message: "branch_id, slot_name, start_time, and end_time are required" });
  }

  const deliveryModuleService = req.scope.resolve("deliveryModuleService");
  const slot = await deliveryModuleService.createDeliverySlots({
    branch_id,
    slot_name,
    start_time,
    end_time,
    max_capacity: max_capacity ?? 10,
    extra_charge: extra_charge ?? 0,
  });

  return res.status(200).json({ delivery_slot: slot });
}
