import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../modules/order-lifecycle";

/**
 * GET /store/orders/:id
 * Customer-authenticated — fetch a single order with its full lifecycle
 * timeline (customer-visible events only), current status, delivery proofs,
 * and refunds.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getCurrentStatus: (orderId: string) => Promise<string | null>;
        getStatusHistory: (orderId: string) => Promise<Record<string, unknown>[]>;
        buildTimeline: (
            orderId: string,
            options?: { includeInternal?: boolean }
        ) => Promise<Record<string, unknown>[]>;
        getDeliveryProofs: (orderId: string) => Promise<Record<string, unknown>[]>;
        getRefunds: (orderId: string) => Promise<Record<string, unknown>[]>;
        buildOrderSummary: (
            order: Record<string, unknown>,
            currentStatus: string | null,
            currentStatusSince: string | null
        ) => Record<string, unknown>;
    };

    const orderId = req.params.id;
    const customerId = (req as any).auth_context?.actor_id as string;

    // Fetch the Medusa core order, verifying ownership.
    const { data: orders } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "created_at",
            "email",
            "shipping_address.*",
            "billing_address.*",
            "items.*",
            "items.variant.*",
            "items.variant.product.*",
            "metadata",
        ],
        filters: { id: orderId },
    });

    const order = (orders as Record<string, unknown>[])?.[0];
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }
    // Ownership check: the order must belong to the authenticated customer.
    if ((order as any).customer_id && (order as any).customer_id !== customerId) {
        return res.status(403).json({ message: "Forbidden." });
    }

    const currentStatus = await orderLifecycleModule.getCurrentStatus(orderId);
    let currentStatusSince: string | null = null;
    const history = await orderLifecycleModule.getStatusHistory(orderId);
    if (history.length > 0) {
        currentStatusSince = new Date(
            history[history.length - 1].created_at as string
        ).toISOString();
    }

    const summary = orderLifecycleModule.buildOrderSummary(
        order,
        currentStatus,
        currentStatusSince
    );
    const timeline = await orderLifecycleModule.buildTimeline(orderId, {
        includeInternal: false,
    });
    const proofs = await orderLifecycleModule.getDeliveryProofs(orderId);
    const refunds = await orderLifecycleModule.getRefunds(orderId);

    return res.status(200).json({
        order: {
            ...summary,
            ...order,
            timeline,
            delivery_proofs: proofs,
            refunds,
        },
    });
}
