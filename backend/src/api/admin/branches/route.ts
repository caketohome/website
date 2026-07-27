import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../modules/shop";
import zod from "zod";

const createSchema = zod.object({
  name: zod.string(),
  code: zod.string(),
  is_open: zod.boolean().optional(),
  phone: zod.string(),
  email: zod.string().email(),
  address: zod.string(),
  latitude: zod.number(),
  longitude: zod.number(),
  shop_id: zod.string(),
  city_id: zod.string().optional(),
  region_id: zod.string().optional(),
  metadata: zod.record(zod.string(), zod.any()).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const branches = await shopModuleService.listBranches({}, { relations: ["city", "region", "settings"] });
    return res.status(200).json({ branches });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = createSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const branch = await shopModuleService.createBranches([validated]);
    return res.status(200).json({ branch: branch[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
