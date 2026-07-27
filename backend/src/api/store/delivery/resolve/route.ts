import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { DELIVERY_MODULE } from "../../../../modules/delivery";

const schema = zod.object({
  pincode: zod.string().optional(),
  latitude: zod.number().optional(),
  longitude: zod.number().optional(),
  address: zod.string().optional(),
});

/**
 * POST /store/delivery/resolve
 * Public location resolution endpoint for storefront customer experience.
 * Accepts pincode, coordinates, or address, and resolves location ETA & fee.
 * NOTE: Internal branch details (branch_id) are KEPT SERVER-SIDE and never exposed.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid location input.", errors: parsed.error.flatten() });
  }

  const deliveryModule = req.scope.resolve(DELIVERY_MODULE) as any;
  try {
    const resolved = await deliveryModule.resolveBranchAndDeliveryDetails(parsed.data);

    // Sanitize response: Return location ETA, fee, pincode, and serviceability (hide branch_id from client)
    return res.status(200).json({
      delivery_pincode: parsed.data.pincode || "560001",
      delivery_location: parsed.data.address || `Pincode ${parsed.data.pincode || "560001"}`,
      delivery_fee: resolved.delivery_fee,
      estimated_delivery_minutes: resolved.estimated_delivery_minutes,
      is_serviceable: true,
      resolution_tier: resolved.resolution_tier,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
