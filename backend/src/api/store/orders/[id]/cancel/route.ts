import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import { ANALYTICS_MODULE } from "../../../../../modules/analytics";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const cancelSchema = zod.object({
    reason: zod.string().min(1).max(500),
});

/**
 * POST /store/orders/:id/cancel
 * Customer-authenticated — cancel an order within the configurable customer
 * cancellation window. Validates the window, records the status transition,
 * emits a timeline event, tracks analytics, and writes an audit log.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
        getValue: <T = string>(group: string, key: string) => Promise<T | null>;
    };
    if (!(await settingsModule.isFeatureEnabled("order_cancellation"))) {
        return res
            .status(403)
            .json({ message: "Order cancellation is not enabled." });
    }

    const parsed = cancelSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid cancellation request.",
            errors: parsed.error.flatten(),
        });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getCurrentStatus: (orderId: string) => Promise<string | null>;
        canCustomerCancel: (
            currentStatus: string,
            placedAt: Date | null,
            windowHours: number
        ) => boolean;
        recordStatusTransition: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const customerId = (req as any).auth_context?.actor_id as string;

    // Verify ownership.
    const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "created_at", "customer_id", "metadata", "items.*"],
        filters: { id: orderId },
    });
    const order = (orders as Record<string, unknown>[])?.[0];
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }
    if ((order as any).customer_id && (order as any).customer_id !== customerId) {
        return res.status(403).json({ message: "Forbidden." });
    }

    const currentStatus = (await orderLifecycleModule.getCurrentStatus(orderId)) ?? "pending";
    const windowHours = Number(
        (await settingsModule.getValue("order_cancellation", "customer_window_hours")) ?? 24
    );
    const placedAt = order.created_at ? new Date(order.created_at as string) : null;

    if (
        !orderLifecycleModule.canCustomerCancel(currentStatus, placedAt, windowHours)
    ) {
        return res.status(409).json({
            message: `Order cannot be cancelled in status "${currentStatus}" or outside the ${windowHours}h cancellation window.`,
        });
    }

    await orderLifecycleModule.recordStatusTransition({
        order_id: orderId,
        from_status: currentStatus,
        to_status: "cancelled",
        actor_type: "customer",
        actor_id: customerId,
        reason: parsed.data.reason,
    });

    // Release reserved inventory back to branch stock
    try {
        const shopModule = req.scope.resolve("shopModuleService") as any;
        const items = (order as any).items as any[];
        const branchId = ((order as any).metadata as any)?.branch_id || "default_branch";

        if (shopModule && Array.isArray(items)) {
            for (const item of items) {
                if (item.variant_id && item.quantity) {
                    await shopModule.releaseInventory(branchId, item.variant_id, item.quantity);
                }
            }
        }
    } catch (e: any) {
        console.warn(`[BUG-004 Fix] Failed to release inventory for cancelled order ${orderId}:`, e.message);
    }

    await analyticsModule.track({
        event_type: "order_cancelled",
        entity_id: orderId,
        customer_id: customerId,
        payload: { reason: parsed.data.reason, source: "customer" },
    });

    await auditModule.log({
        actor_id: customerId,
        actor_type: "customer",
        action: "order.cancel",
        entity: "order",
        entity_id: orderId,
        metadata: { reason: parsed.data.reason },
    });

    return res.status(200).json({ id: orderId, status: "cancelled" });
}
