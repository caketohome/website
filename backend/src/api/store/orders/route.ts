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
        getBatchStatusHistories?: (
            orderIds: string[]
        ) => Promise<Map<string, Record<string, unknown>[]>>;
        buildOrderSummary: (
            order: Record<string, unknown>,
            currentStatus: string | null,
            currentStatusSince: string | null
        ) => Record<string, unknown>;
    };

    const customerId = (req as any).auth_context?.actor_id as string;
    const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
    const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);
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
            order: { created_at: "DESC", id: "DESC" },
        },
    });

    const orderList = (orders || []) as Record<string, unknown>[];
    const orderIds = orderList.map((o) => o.id as string).filter(Boolean);

    // Batch fetch status histories in 1 query instead of 2N loop queries
    let batchHistories = new Map<string, Record<string, unknown>[]>();
    if (orderLifecycleModule.getBatchStatusHistories && orderIds.length > 0) {
        batchHistories = await orderLifecycleModule.getBatchStatusHistories(orderIds);
    }

    // Enrich each order with the lifecycle current status.
    const summaries: Record<string, unknown>[] = [];
    for (const order of orderList) {
        const orderId = order.id as string;
        const history = batchHistories.get(orderId);
        let currentStatus: string | null = null;
        let currentStatusSince: string | null = null;

        if (history && history.length > 0) {
            currentStatus = history[history.length - 1].to_status as string;
            currentStatusSince = new Date(
                history[history.length - 1].created_at as string
            ).toISOString();
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

    const total = (metadata as Record<string, unknown>)?.count ?? summaries.length;

    return res.status(200).json({
        orders: summaries,
        count: summaries.length,
        offset,
        limit,
        total,
        pagination: {
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
            total,
            hasNextPage: offset + summaries.length < (typeof total === "number" ? total : summaries.length),
            hasPreviousPage: offset > 0,
        },
    });
}
