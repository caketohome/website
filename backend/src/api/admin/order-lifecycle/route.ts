import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../modules/order-lifecycle";

/**
 * GET /admin/order-lifecycle
 * Admin — list orders with their lifecycle status. Supports filtering by
 * lifecycle status and pagination. Returns enriched order summaries.
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

    const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
    const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);
    const statusFilter = req.query.status as string | undefined;

    const { data: orders, metadata } = await query.graph({
        entity: "order",
        fields: [
            "id",
            "display_id",
            "status",
            "total",
            "currency_code",
            "created_at",
            "email",
            "customer_id",
            "items.quantity",
            "metadata",
        ],
        pagination: {
            take: limit,
            skip: offset,
            order: { created_at: "DESC", id: "DESC" },
        },
    });

    const orderList = (orders || []) as Record<string, unknown>[];
    const orderIds = orderList.map((o) => o.id as string).filter(Boolean);

    // Batch fetch status histories in a single query (101 queries -> 2 queries)
    let batchHistories = new Map<string, Record<string, unknown>[]>();
    if (orderLifecycleModule.getBatchStatusHistories && orderIds.length > 0) {
        batchHistories = await orderLifecycleModule.getBatchStatusHistories(orderIds);
    }

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

        if (statusFilter && currentStatus !== statusFilter) continue;
        summaries.push(
            orderLifecycleModule.buildOrderSummary(order, currentStatus, currentStatusSince)
        );
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
