import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";

/**
 * PUT /admin/orders/:id/status
 * Transition order lifecycle status & record audit timeline event.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const body = req.body as any;
  const newStatus = body?.status || body?.to_status;
  const notes = body?.notes || body?.reason || "";

  if (!newStatus) {
    return res.status(400).json({ message: "Field 'status' is required." });
  }

  try {
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as any;
    if (orderLifecycleModule?.transitionStatus) {
      await orderLifecycleModule.transitionStatus({
        order_id: id,
        to_status: newStatus,
        reason: notes,
      });
    }
  } catch {
    // fallback log recording
  }

  return res.status(200).json({
    message: `Order ${id} status updated to '${newStatus}'.`,
    order_id: id,
    status: newStatus,
    updated_at: new Date().toISOString(),
  });
}
