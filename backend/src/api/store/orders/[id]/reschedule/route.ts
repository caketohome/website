import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { SETTINGS_MODULE } from "../../../../../modules/settings";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const rescheduleSchema = zod.object({
    requested_date: zod.string().min(1),
    requested_slot_id: zod.string().optional(),
    reason: zod.string().max(500).optional(),
});

/**
 * POST /store/orders/:id/reschedule
 * Customer-authenticated — request a delivery slot/date reschedule. Creates a
 * reschedule request in "requested" status for staff approval. Gated by the
 * `rescheduling` feature flag and a configurable minimum-hours-before-delivery
 * window (Settings: rescheduling.min_hours_before_delivery).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
        getValue: <T = string>(group: string, key: string) => Promise<T | null>;
    };
    if (!(await settingsModule.isFeatureEnabled("rescheduling"))) {
        return res
            .status(403)
            .json({ message: "Rescheduling is not enabled." });
    }

    const parsed = rescheduleSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid reschedule request.",
            errors: parsed.error.flatten(),
        });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        createRescheduleRequest: (
            input: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const customerId = (req as any).auth_context?.actor_id as string;

    // Verify ownership.
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

    const request = await orderLifecycleModule.createRescheduleRequest({
        order_id: orderId,
        requested_by_type: "customer",
        requested_by_id: customerId,
        requested_date: parsed.data.requested_date,
        requested_slot_id: parsed.data.requested_slot_id ?? null,
        reason: parsed.data.reason ?? null,
    });

    await auditModule.log({
        actor_id: customerId,
        actor_type: "customer",
        action: "order.reschedule_request",
        entity: "order",
        entity_id: orderId,
        metadata: {
            requested_date: parsed.data.requested_date,
            requested_slot_id: parsed.data.requested_slot_id ?? null,
        },
    });

    return res.status(201).json({ reschedule_request: request });
}
