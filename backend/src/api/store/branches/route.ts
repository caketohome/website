import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../modules/shop";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;

  try {
    const branches = await shopModuleService.listBranches(
      { is_open: true },
      { relations: ["city", "region", "settings"] }
    );
    return res.status(200).json({ branches });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  const body = (req.body || {}) as any;
  try {
    const branchData = {
      name: body.name || "Default Branch",
      code: body.code || `BR-${Date.now()}`,
      is_open: body.is_open ?? true,
      phone: body.phone || "+919876543210",
      email: body.email || "branch@cakes2home.com",
      address: body.address || "123 Main St",
      latitude: body.latitude || 12.9716,
      longitude: body.longitude || 77.5946,
      shop_id: body.shop_id,
    };
    const branch = await shopModuleService.createBranches([branchData]);
    return res.status(200).json({ branch: branch[0] });
  } catch (error: any) {
    console.error("Branch Creation Error:", error);
    return res.status(400).json({ message: error.message, error });
  }
}
