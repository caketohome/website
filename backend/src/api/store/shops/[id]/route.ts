import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { QueryContext } from "@medusajs/framework/utils";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { query } from "express";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const { currency_code = "eur", ...reqQuery } = req.query;

  const shopId = req.params.id;

  const shopQuery = {
    entity: "shop",
    fields: [
      "*",
      "products.*",
      "products.categories.*",
      "products.categories.*",
      "products.variants.*",
      "products.variants.calculated_price.*",
      "deliveries.*",
      "deliveries.cart.*",
      "deliveries.cart.items.*",
      "deliveries.order.*",
      "deliveries.order.items.*",
    ],
    filters: {
      id: shopId,
    },
    context: {
      products: {
        variants: {
          calculated_price: QueryContext({
            currency_code,
          }),
        },
      },
    },
  };

  const {
    data: [shop],
  } = await query.graph(shopQuery);

  return res.status(200).json({ shop });
}
