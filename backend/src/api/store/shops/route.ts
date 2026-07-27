import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/utils";
import zod from "zod";
import { CreateShopDTO } from "../../../modules/shop/types/mutations";
import { createShopWorkflow } from "../../../workflows/shop/workflows";
import { QueryContext } from "@medusajs/framework/utils";

const schema = zod.object({
  name: zod.string(),
  handle: zod.string(),
  address: zod.string(),
  phone: zod.string(),
  email: zod.string(),
  image_url: zod.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = schema.parse(req.body) as CreateShopDTO;

  if (!validatedBody) {
    return MedusaError.Types.INVALID_DATA;
  }

  const { result: shop } = await createShopWorkflow(req.scope).run({
    input: {
      shop: validatedBody,
    },
  });

  return res.status(200).json({ message: "Shop created", shop });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { currency_code = "eur", ...queryFilters } = req.query;

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const shopsQuery = {
    entity: "shop",
    fields: [
      "id",
      "handle",
      "name",
      "address",
      "phone",
      "email",
      "image_url",
      "is_open",
      "products.*",
      "products.categories.*",
      "products.variants.*",
      "products.variants.calculated_price.*",
    ],
    filters: queryFilters,
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

  const { data: shops } = await query.graph(shopsQuery);

  return res.status(200).json({ shops });
}
