import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../../modules/delivery/service";

/**
 * POST /store/delivery_partners/attendance
 * Storefront — Check-in or check-out driver shifts.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;
  const { action } = req.body as any;

  const partnerId = (req as any).auth_context?.app_metadata?.delivery_partner_id || "dlp_1";

  try {
    let result;
    if (action === "checkin") {
      result = await deliveryService.checkIn(partnerId);
    } else if (action === "checkout") {
      result = await deliveryService.checkOut(partnerId);
    } else {
      return res.status(400).json({ message: `Unsupported action: ${action}` });
    }

    return res.status(200).json({ attendance: result });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
