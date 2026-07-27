import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../modules/shop";
import zod from "zod";

const schema = zod.object({
  name: zod.string(),
  state: zod.string(),
  is_active: zod.boolean().optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const cities = await shopModuleService.listCities();
    return res.status(200).json({ cities });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = schema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const city = await shopModuleService.createCities([validated]);
    return res.status(200).json({ city: city[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
