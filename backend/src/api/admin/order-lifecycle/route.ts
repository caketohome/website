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
        buildOrderSummary: (
            order: Record<string, unknown>,
            currentStatus: string | null,
            currentStatusSince: string | null
        ) => Record<string, unknown>;
    };

    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
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
            order: { created_at: "DESC" },
        },
    });

    const summaries: Record<string, unknown>[] = [];
    for (const order of orders as Record<string, unknown>[]) {
        const currentStatus = await orderLifecycleModule.getCurrentStatus(
            order.id as string
        );
        if (statusFilter && currentStatus !== statusFilter) continue;
        let currentStatusSince: string | null = null;
        const history = await orderLifecycleModule.getStatusHistory(order.id as string);
        if (history.length > 0) {
            currentStatusSince = new Date(
                history[history.length - 1].created_at as string
            ).toISOString();
        }
        summaries.push(
            orderLifecycleModule.buildOrderSummary(order, currentStatus, currentStatusSince)
        );
    }

    return res.status(200).json({
        orders: summaries,
        count: summaries.length,
        offset,
        limit,
        total: (metadata as Record<string, unknown>)?.count ?? summaries.length,
    });
}
