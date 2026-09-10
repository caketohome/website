import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import zod from "zod";
import {
  createDeliveryWorkflow,
  handleDeliveryWorkflow,
} from "../../../workflows/delivery/workflows";

const schema = zod.object({
  cart_id: zod.string().startsWith("cart_"),
  shop_id: zod.string().startsWith("res_"),
  delivery_date: zod.string().optional().nullable(),
  delivery_slot_id: zod.string().optional().nullable(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body);

  const { result: delivery } = await createDeliveryWorkflow(req.scope).run({
    input: {
      cart_id: validatedBody.cart_id,
      shop_id: validatedBody.shop_id,
      delivery_date: validatedBody.delivery_date,
      delivery_slot_id: validatedBody.delivery_slot_id,
    },
  });

  const { transaction } = await handleDeliveryWorkflow(req.scope).run({
    input: {
      delivery_id: delivery.id,
    },
  });

  return res
    .status(200)
    .json({ message: "Delivery created", delivery, transaction });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const filters = {} as Record<string, any>;
  const take = Math.min(Math.max(1, parseInt(req.query.take as string) || 20), 100);
  const skip = Math.max(0, parseInt(req.query.skip as string) || 0);

  for (const key in req.query) {
    if (["take", "skip"].includes(key)) continue;

    filters[key] = req.query[key];
  }
  const deliveryQuery = {
    entity: "delivery",
    fields: ["*", "cart.*", "cart.items.*", "order.*", "order.items.*"],
    filters,
    pagination: {
      take,
      skip,
      order: { created_at: "DESC", id: "DESC" },
    },
  };

  const { data: deliveries } = await query.graph(deliveryQuery);

  if (filters.hasOwnProperty("delivery_partner_id")) {
    const delivery_partnerQuery = {
      entity: "delivery_partner",
      fields: ["delivery_partner_id", "delivery_id"],
      filters: {
        deleted_at: null,
        delivery_partner_id: filters["delivery_partner_id"],
      },
    };

    const { data: availableDeliveriesIds } = await query.graph(delivery_partnerQuery);

    const availableDeliveriesQuery = {
      entity: "delivery",
      fields: ["*", "cart.*", "cart.items.*", "order.*", "order.items.*"],
      filters: {
        id: availableDeliveriesIds.map((d) => d.delivery_id),
      },
    };

    const { data: availableDeliveries } = await query.graph(
      availableDeliveriesQuery
    );

    deliveries.push(...availableDeliveries);
  }

  return res.status(200).json({
    deliveries,
    count: deliveries.length,
    limit: take,
    offset: skip,
  });
}
