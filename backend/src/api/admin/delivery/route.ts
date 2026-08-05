import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../modules/delivery/service";
import zod from "zod";

const createDeliverySchema = zod.object({
  transaction_id: zod.string().optional(),
  delivery_partner_id: zod.string().optional(),
  delivery_date: zod.string().optional(),
  recipient_name: zod.string().optional(),
  recipient_phone: zod.string().optional(),
  recipient_address: zod.string().optional(),
  recipient_pincode: zod.string().optional(),
  delivery_instructions: zod.string().optional(),
});

/**
 * POST /admin/delivery
 * Admin — Create a delivery record for an order.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res
      .status(401)
      .json({ message: "Unauthorized. Admin credentials required." });
  }

  const validated = createDeliverySchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({
      message: "Invalid delivery data.",
      errors: validated.error.format(),
    });
  }

  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;

  try {
    const delivery = await deliveryService.createDeliveries(validated.data);
    return res.status(201).json({ delivery });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * GET /admin/delivery
 * Admin — List all delivery records.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res
      .status(401)
      .json({ message: "Unauthorized. Admin credentials required." });
  }

  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;

  try {
    const deliveries = await deliveryService.listDeliveries();
    return res.status(200).json({ deliveries, count: deliveries.length });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
