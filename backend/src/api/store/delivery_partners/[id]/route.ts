import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/utils";
import zod from "zod";
import { DELIVERY_MODULE } from "../../../../modules/delivery";

const schema = zod.object({
  first_name: zod.string().optional(),
  last_name: zod.string().optional(),
  email: zod.string().optional(),
  phone: zod.string().optional(),
  avatar_url: zod.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body);

  if (!validatedBody) {
    return MedusaError.Types.INVALID_DATA;
  }

  const deliveryModuleService = req.scope.resolve(DELIVERY_MODULE) as any;

  const delivery_partnerId = req.params.id;

  const data = {
    id: delivery_partnerId,
    ...validatedBody,
  };

  if (!delivery_partnerId) {
    return MedusaError.Types.NOT_FOUND;
  }

  const delivery_partner = await deliveryModuleService.updateDeliveryPartners(data);

  return res.status(200).json({ delivery_partner });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const delivery_partnerId = req.params.id;

  if (!delivery_partnerId) {
    return MedusaError.Types.INVALID_DATA;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as any;

  const delivery_partnerQuery = {
    entity: "delivery_partner",
    filters: {
      id: delivery_partnerId,
    },
    fields: ["id", "first_name", "last_name", "email", "phone", "avatar_url"],
  };

  const {
    data: [delivery_partner],
  } = await query.graph(delivery_partnerQuery);

  return res.status(200).json({ delivery_partner });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const delivery_partnerId = req.params.id;

  if (!delivery_partnerId) {
    return MedusaError.Types.INVALID_DATA;
  }

  const deliveryModuleService = req.scope.resolve(DELIVERY_MODULE) as any;

  await deliveryModuleService.deleteDeliveryPartners(delivery_partnerId);

  return res.status(200).json({ message: "DeliveryPartner deleted" });
}
