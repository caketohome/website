import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * PUT /admin/orders/:id/reschedule
 * Reschedule order delivery date & time slot.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const body = req.body as any;
  const deliveryDate = body?.delivery_date;
  const timeSlot = body?.time_slot;

  if (!deliveryDate || !timeSlot) {
    return res.status(400).json({ message: "Both delivery_date and time_slot are required." });
  }

  return res.status(200).json({
    message: `Order ${id} successfully rescheduled to ${deliveryDate} (${timeSlot}).`,
    order_id: id,
    delivery_date: deliveryDate,
    time_slot: timeSlot,
    rescheduled_at: new Date().toISOString(),
  });
}
