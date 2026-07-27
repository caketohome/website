import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../modules/order-lifecycle";

/**
 * GET /store/orders
 * Customer-authenticated — list the authenticated customer's order history
 * with the CakeToHome lifecycle status (not just the Medusa core status).
 *
 * Query params:
 *   - limit (default 20), offset (default 0)
 *   - status (filter by lifecycle status)
 *
 * The Medusa core order list is queried via the framework query service and
 * enriched with the lifecycle current status + current-status-since timestamp.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getCurrentStatus: (orderId: string) => Promise<string | null>;
        getStatusHistory: (orderId: string) => Promise<Record<string, unknown>[]>;
        buildOrderSummary: (
            order: Record<string, unknown>,
            currentStatus: string | null,
            currentStatusSince: string | null
        ) => Record<string, unknown>;
    };

    const customerId = (req as any).auth_context?.actor_id as string;
    const limit = req.query.limit ? Number(req.query.limit) : 20;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const statusFilter = req.query.status as string | undefined;

    // Query the Medusa core orders for this customer.
    const { data: orders, metadata } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "created_at",
            "items.quantity",
            "metadata",
        ],
        filters: { customer_id: customerId },
        pagination: {
            take: limit,
            skip: offset,
            order: { created_at: "DESC" },
        },
    });

    // Enrich each order with the lifecycle current status.
    const summaries: Record<string, unknown>[] = [];
    for (const order of orders as Record<string, unknown>[]) {
        const currentStatus = await orderLifecycleModule.getCurrentStatus(
            order.id as string
        );
        let currentStatusSince: string | null = null;
        if (currentStatus) {
            const history = await orderLifecycleModule.getStatusHistory(
                order.id as string
            );
            if (history.length > 0) {
                currentStatusSince = new Date(
                    history[history.length - 1].created_at as string
                ).toISOString();
            }
        }
        const summary = orderLifecycleModule.buildOrderSummary(
            order,
            currentStatus,
            currentStatusSince
        );
        // Apply optional status filter post-enrichment.
        if (!statusFilter || summary.status === statusFilter) {
            summaries.push(summary);
        }
    }

    return res.status(200).json({
        orders: summaries,
        count: summaries.length,
        offset,
        limit,
        total: (metadata as Record<string, unknown>)?.count ?? summaries.length,
    });
}
