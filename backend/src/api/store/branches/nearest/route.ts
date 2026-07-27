import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../modules/shop";
import zod from "zod";

const querySchema = zod.object({
  lat: zod.string().transform(Number),
  lng: zod.string().transform(Number),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const validatedQuery = querySchema.safeParse(req.query);
  if (!validatedQuery.success) {
    return res.status(400).json({ message: "Invalid query parameters. Provide numeric 'lat' and 'lng'." });
  }

  const { lat, lng } = validatedQuery.data;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;

  try {
    const branch = await shopModuleService.findNearestBranch(lat, lng);
    if (!branch) {
      return res.status(404).json({ message: "No serviceable branches found within delivery range." });
    }
    return res.status(200).json({ branch });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
