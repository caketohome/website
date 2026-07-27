import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import DeliveryModuleService from "../../../../../../modules/delivery/service";

/**
 * GET /store/deliveries/:id/track/stream
 * Storefront — Live tracking coordinates SSE stream for customer maps.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const deliveryService = req.scope.resolve("deliveryModuleService") as any;

  const delivery = await deliveryService.retrieveDelivery(id).catch(() => null);
  if (!delivery) {
    return res.status(404).json({ message: `Delivery ${id} not found.` });
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });

  res.write("data: connected\n\n");

  const listener = (location: any) => {
    if (location.partner_id === delivery.delivery_partner_id) {
      res.write(`data: ${JSON.stringify(location)}\n\n`);
    }
  };

  DeliveryModuleService.gpsEmitter.on("location", listener);

  req.on("close", () => {
    DeliveryModuleService.gpsEmitter.off("location", listener);
    res.end();
  });
}
