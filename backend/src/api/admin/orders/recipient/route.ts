import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { DELIVERY_MODULE } from "../../../../modules/delivery";

const updateRecipientSchema = zod.object({
  delivery_id: zod.string(),
  recipient_name: zod.string().optional(),
  recipient_phone: zod.string().optional(),
  recipient_address: zod.string().optional(),
  delivery_instructions: zod.string().optional(),
  gift_message: zod.string().optional(),
});

/**
 * POST /admin/orders/recipient
 * Admin & Branch Staff endpoint: Edit recipient information or resend recipient notifications prior to dispatch.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = updateRecipientSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input.", errors: parsed.error.flatten() });
  }

  const deliveryModule = req.scope.resolve(DELIVERY_MODULE) as any;
  try {
    const updated = await deliveryModule.updateDeliveries({
      id: parsed.data.delivery_id,
      ...parsed.data,
    });
    return res.status(200).json({ message: "Recipient details updated successfully.", delivery: updated[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
