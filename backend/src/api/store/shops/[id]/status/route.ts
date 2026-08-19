import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { SHOP_MODULE } from "../../../../../modules/shop";

const schema = zod.object({
  is_open: zod.boolean(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const { is_open } = schema.parse(req.body);

  const shopService = req.scope.resolve(SHOP_MODULE) as any;

  try {
    const shop = await shopService.updateShops({
      id,
      is_open,
    });
    res.status(200).json({ shop });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
