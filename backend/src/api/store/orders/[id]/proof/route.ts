import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";

/**
 * GET /store/orders/:id/proof
 * Customer-authenticated — fetch the delivery proof (photo + signature) for
 * an order. Returns the delivery proof records (URLs reference Media Module
 * M10 assets). Gated by the `proof_of_delivery` feature flag (checked in the
 * detail route; this endpoint is harmless if no proof exists yet).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getDeliveryProofs: (orderId: string) => Promise<Record<string, unknown>[]>;
    };

    const orderId = req.params.id;
    const customerId = (req as any).auth_context?.actor_id as string;

    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "customer_id"],
        filters: { id: orderId },
    });
    const order = (orders as Record<string, unknown>[])?.[0];
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }
    if ((order as any).customer_id && (order as any).customer_id !== customerId) {
        return res.status(403).json({ message: "Forbidden." });
    }

    const proofs = await orderLifecycleModule.getDeliveryProofs(orderId);
    return res.status(200).json({ proofs });
}
