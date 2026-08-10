import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SHOP_MODULE } from "../../../../modules/shop";
import zod from "zod";

const selectSchema = zod.object({
  lat: zod.number(),
  lng: zod.number(),
  items: zod.array(
    zod.object({
      variant_id: zod.string(),
      qty: zod.number(),
    })
  ).optional().default([]),
  slot_time: zod.string().optional(),
  cart_id: zod.string().optional(),
});

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const validated = selectSchema.safeParse(req.body);
  if (!validated.success) {
    return res.status(400).json({ message: "Invalid payload params.", errors: validated.error.format() });
  }

  const { lat, lng, items, slot_time, cart_id } = validated.data;
  const shopModuleService = req.scope.resolve(SHOP_MODULE) as any;

  try {
    const branch = await shopModuleService.selectBestBranch(lat, lng, items, slot_time);
    if (!branch) {
      return res.status(404).json({ message: "No serviceable branches matched coordinates and capacities." });
    }

    let reservation = null;
    if (cart_id && slot_time) {
      reservation = await shopModuleService.reserveSlot(cart_id, branch.id, slot_time);
    }

    return res.status(200).json({ branch, reservation });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
