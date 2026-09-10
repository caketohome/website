import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branch_id = req.query.branch_id as string;
  const date = req.query.date as string; // YYYY-MM-DD

  if (!branch_id || !date) {
    return res.status(400).json({ message: "branch_id and date query parameters are required" });
  }

  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;
  
  // Retrieve all configured slots for the branch
  const slots = (await deliveryModuleService.listDeliverySlots({ branch_id })) || [];
  const slotIds = slots.map((s: any) => s.id).filter(Boolean);

  // Batch query all bookings for the branch's slots on the given date (N queries -> 1 query)
  let allDeliveries: any[] = [];
  if (slotIds.length > 0) {
    allDeliveries = (await deliveryModuleService.listDeliveries({
      delivery_slot_id: slotIds,
      delivery_date: date,
    })) || [];
  }

  const bookingCountBySlot = new Map<string, number>();
  for (const delivery of allDeliveries) {
    const sid = delivery.delivery_slot_id as string;
    bookingCountBySlot.set(sid, (bookingCountBySlot.get(sid) || 0) + 1);
  }

  // Resolve available slots synchronously in memory
  const resolvedSlots = slots.map((slot: any) => {
    const bookedCount = bookingCountBySlot.get(slot.id) || 0;
    const isAvailable = bookedCount < slot.max_capacity;

    return {
      id: slot.id,
      slot_name: slot.slot_name,
      start_time: slot.start_time,
      end_time: slot.end_time,
      extra_charge: slot.extra_charge,
      max_capacity: slot.max_capacity,
      booked_count: bookedCount,
      available: isAvailable,
      remaining_capacity: Math.max(0, slot.max_capacity - bookedCount),
    };
  });

  return res.status(200).json({ delivery_slots: resolvedSlots });
}
