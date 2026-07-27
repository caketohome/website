import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import { ANALYTICS_MODULE } from "../../../../../modules/analytics";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const refundSchema = zod.object({
    amount: zod.number().int().min(1),
    refund_channel: zod.enum(["payment_provider", "wallet", "mixed"]).optional(),
    reason_code: zod.string().max(100).optional(),
    reason: zod.string().max(500).optional(),
    provider_refund_id: zod.string().optional(),
});

/**
 * POST /admin/order-lifecycle/:id/refunds
 * Admin — record a refund against an order. The refund-to-wallet option is
 * configurable via Settings (refunds.refund_to_wallet). This endpoint records
 * the auditable refund; the actual money movement is coordinated with the M7
 * Payment Provider abstraction by the caller (or a future workflow).
 *
 * On a successful refund, the order transitions to "refunded" when the total
 * refunded amount meets or exceeds the order total.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
        getValue: <T = string>(group: string, key: string) => Promise<T | null>;
    };
    if (!(await settingsModule.isFeatureEnabled("refunds"))) {
        return res.status(403).json({ message: "Refunds are not enabled." });
    }

    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid refund.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        recordRefund: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
        totalRefunded: (orderId: string) => Promise<number>;
        getCurrentStatus: (orderId: string) => Promise<string | null>;
        recordStatusTransition: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;

    // Apply the configurable refund-to-wallet default when the caller did not
    // specify a channel explicitly.
    let refundChannel = parsed.data.refund_channel ?? "payment_provider";
    const refundToWallet = await settingsModule.getValue<boolean>("refunds", "refund_to_wallet");
    if (refundToWallet === true && !parsed.data.refund_channel) {
        refundChannel = "wallet";
    }

    const refund = await orderLifecycleModule.recordRefund({
        order_id: orderId,
        amount: parsed.data.amount,
        refund_channel: refundChannel,
        reason_code: parsed.data.reason_code ?? null,
        reason: parsed.data.reason ?? null,
        actor_type: "admin",
        actor_id: actorId ?? null,
        provider_refund_id: parsed.data.provider_refund_id ?? null,
        status: "processed",
    });

    await analyticsModule.track({
        event_type: "refund_issued",
        entity_id: orderId,
        payload: {
            amount: parsed.data.amount,
            refund_channel: refundChannel,
            reason: parsed.data.reason ?? null,
        },
    });

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: "admin",
        action: "order.refund_issued",
        entity: "order",
        entity_id: orderId,
        metadata: {
            amount: parsed.data.amount,
            refund_channel: refundChannel,
            reason: parsed.data.reason ?? null,
        },
    });

    // If the total refunded now meets/exceeds the order total, transition to refunded.
    try {
        const totalRefunded = await orderLifecycleModule.totalRefunded(orderId);
        const orderTotal = Number(parsed.data.amount) > 0 ? null : null; // resolved below
        // Fetch order total to compare.
        const { ContainerRegistrationKeys } = await import("@medusajs/utils");
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
        const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "total"],
            filters: { id: orderId },
        });
        const orderTotalValue = (orders as Record<string, unknown>[])?.[0]?.total as number | undefined;
        if (orderTotalValue && totalRefunded >= orderTotalValue) {
            const currentStatus = (await orderLifecycleModule.getCurrentStatus(orderId)) ?? "delivered";
            if (currentStatus !== "refunded") {
                await orderLifecycleModule.recordStatusTransition({
                    order_id: orderId,
                    from_status: currentStatus,
                    to_status: "refunded",
                    actor_type: "admin",
                    actor_id: actorId ?? null,
                    reason: "Full refund issued",
                });
            }
        }
        void orderTotal; // suppress unused
    } catch {
        // Transition is best-effort; the refund record is the source of truth.
    }

    return res.status(201).json({ refund });
}
