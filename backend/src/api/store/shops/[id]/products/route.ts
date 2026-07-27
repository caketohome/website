import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/utils";
import { deleteProductsWorkflow } from "@medusajs/core-flows";
import { createShopProductsWorkflow } from "../../../../../workflows/shop/workflows";
import { AdminCreateProduct } from "@medusajs/types";
import { z } from "zod";

const createSchema = z.object({
  products: z.array(z.custom<AdminCreateProduct>()),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = createSchema.parse(req.body);

  const { result: shopProducts } = await createShopProductsWorkflow(
    req.scope
  ).run({
    input: {
      products: validatedBody.products as any[],
      shop_id: req.params.id,
    },
  });

  // Return the product
  return res.status(200).json({ shop_products: shopProducts });
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopId = req.params.id;

  if (!shopId) {
    return MedusaError.Types.NOT_FOUND;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  const shopProductsQuery = {
    entity: "product",
    filters: {
      shop: shopId,
    },
    fields: [
      "id",
      "title",
      "description",
      "thumbnail",
      "categories.*",
      "categories.id",
      "categories.name",
      "variants.*",
      "variants.id",
      "variants.price_set.*",
      "variants.price_set.id",
      "shop.*",
    ],
  };

  const { data: shopProducts } = await query.graph(
    shopProductsQuery
  );

  return res.status(200).json({ shop_products: shopProducts });
}

const deleteSchema = z.object({
  product_ids: z.string().array(),
});

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const validatedBody = deleteSchema.parse(req.body);

  await deleteProductsWorkflow(req.scope).run({
    input: {
      ids: validatedBody.product_ids,
    },
  });

  return res.status(200).json({ success: true });
}
