import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../../modules/shop";
import zod from "zod";

const staffSchema = zod.object({
  first_name: zod.string(),
  last_name: zod.string(),
  email: zod.string().email(),
  phone: zod.string(),
  role: zod.enum([
    "Branch Manager",
    "Cashier",
    "Delivery Manager",
    "Delivery Staff",
    "Customer Support",
    "Inventory Manager",
  ]),
  is_active: zod.boolean().optional(),
  metadata: zod.record(zod.string(), zod.any()).optional(),
});

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    const staff = await shopModuleService.listBranchStaffs({ branch_id: branchId });
    return res.status(200).json({ staff });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const branchId = req.params.id;
  const validated = staffSchema.parse(req.body);
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;
  try {
    // Check if staff email already exists
    const [existing] = await shopModuleService.listBranchStaffs({ email: validated.email });
    if (existing) {
      return res.status(400).json({ message: "Staff member with this email already exists." });
    }

    const staff = await shopModuleService.createBranchStaffs([
      {
        branch_id: branchId,
        ...validated,
      },
    ]);
    return res.status(200).json({ staff: staff[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
