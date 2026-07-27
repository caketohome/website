import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { passDeliveryWorkflow } from "../../../../../workflows/delivery/workflows";

const schema = zod.object({
  delivery_partner_id: zod.string(),
});

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body);

  const deliveryId = req.params.id;

  await passDeliveryWorkflow(req.scope).run({
    input: {
      delivery_partner_id: validatedBody.delivery_partner_id,
      delivery_id: deliveryId,
    },
  });

  return res.status(200).json({ message: "DeliveryPartner declined delivery" });
}
