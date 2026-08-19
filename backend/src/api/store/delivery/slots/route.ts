import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branch_id = req.query.branch_id as string;
  const date = req.query.date as string; // YYYY-MM-DD

  if (!branch_id || !date) {
    return res.status(400).json({ message: "branch_id and date query parameters are required" });
  }

  const deliveryModuleService = req.scope.resolve("deliveryModuleService") as any;
  
  // Retrieve all configured slots for the branch
  const slots = await deliveryModuleService.listDeliverySlots({ branch_id });

  // Resolve available slots by querying current bookings for each slot
  const resolvedSlots = await Promise.all(
    slots.map(async (slot) => {
      const bookings = await deliveryModuleService.listDeliveries({
        delivery_slot_id: slot.id,
        delivery_date: date,
      });

      const bookedCount = bookings.length;
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
    })
  );

  return res.status(200).json({ delivery_slots: resolvedSlots });
}
