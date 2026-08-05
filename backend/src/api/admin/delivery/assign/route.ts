import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../../modules/delivery/service";
import { DeliveryStatus } from "../../../../modules/delivery/types/common";

/**
 * POST /admin/delivery/assign
 * Admin — Manually assign or override delivery partner for an order.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;
  const { delivery_id, partner_id } = req.body as any;

  if (!delivery_id || !partner_id) {
    return res.status(400).json({ message: "delivery_id and partner_id are required." });
  }

  try {
    const updated = await deliveryService.updateDeliveries({
      selector: { id: delivery_id },
      data: {
        delivery_partner_id: partner_id,
        delivery_status: DeliveryStatus.PICKUP_CLAIMED,
      },
    });

    // Write to junction table
    await deliveryService.createDeliveryDeliveryPartners([
      {
        delivery_id,
        delivery_partner_id: partner_id,
      },
    ]);

    return res.status(200).json({ delivery: updated[0] || updated });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
