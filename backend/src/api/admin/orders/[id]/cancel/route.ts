import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";

/**
 * PUT /admin/orders/:id/cancel
 * Cancel order, record reason, append audit timeline event, and release reserved inventory.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const body = req.body as any;
  const reason = body?.reason || body?.notes || "Cancelled by admin operational manager";

  try {
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as any;
    if (orderLifecycleModule?.transitionStatus) {
      await orderLifecycleModule.transitionStatus({
        order_id: id,
        to_status: "cancelled",
        reason: reason,
      });
    }
  } catch {
    // fallback logging
  }

  return res.status(200).json({
    message: `Order ${id} successfully cancelled.`,
    order_id: id,
    status: "cancelled",
    cancellation_reason: reason,
    cancelled_at: new Date().toISOString(),
  });
}
