import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../../../modules/delivery/service";

/**
 * POST /store/deliveries/:id/gps
 * Storefront — Submit live GPS location logs from driver partner.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;
  const { latitude, longitude } = req.body as any;

  // Resolve driver partner id from auth context or fallback mock
  const partnerId = (req as any).auth_context?.app_metadata?.delivery_partner_id || "dlp_1";

  if (!latitude || !longitude) {
    return res.status(400).json({ message: "latitude and longitude are required." });
  }

  try {
    const log = await deliveryService.logDriverLocation(partnerId, String(latitude), String(longitude));
    return res.status(201).json({ log });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
