import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { DELIVERY_MODULE } from "../../../../modules/delivery/service";

/**
 * GET /admin/delivery/dispatch
 * Admin — Retrieve dispatch analytics summary (active jobs, driver locations, attendance).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const deliveryService = req.scope.resolve(DELIVERY_MODULE) as any;

  try {
    const deliveries = await deliveryService.listDeliveries();
    const drivers = await deliveryService.listDriverProfiles();
    const attendances = await deliveryService.listDriverAttendances();

    // Map active locations (mock/real coords logs)
    const locations = await deliveryService.listDriverLocations({}, { order: { logged_at: "DESC" } });

    return res.status(200).json({
      deliveries,
      drivers,
      attendances,
      locations,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
