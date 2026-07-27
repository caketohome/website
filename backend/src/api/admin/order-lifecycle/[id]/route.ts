import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../modules/order-lifecycle";
import { SETTINGS_MODULE } from "../../../../modules/settings";
import { AUDIT_MODULE } from "../../../../modules/audit";
import { NOTIFICATION_MODULE } from "../../../../modules/notification";
import zod from "zod";

/**
 * GET /admin/order-lifecycle/:id
 * Admin — fetch an order with its full lifecycle timeline (including internal
 * events), status history, notes, refunds, reschedule requests, delivery
 * proofs, and staff assignments.
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
        getRescheduleRequests: (orderId: string) => Promise<Record<string, unknown>[]>;
        listStaffAssignments: (
            orderId: string,
            options?: { activeOnly?: boolean }
        ) => Promise<Record<string, unknown>[]>;
        listNotes: (
            orderId: string,
            options?: { note_type?: string }
        ) => Promise<Record<string, unknown>[]>;
    };

    const orderId = req.params.id;

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
            "customer_id",
            "shipping_address.*",
            "billing_address.*",
            "items.*",
            "metadata",
        ],
        filters: { id: orderId },
    });
    const order = (orders as Record<string, unknown>[])?.[0];
    if (!order) {
        return res.status(404).json({ message: "Order not found." });
    }

    const currentStatus = (await orderLifecycleModule.getCurrentStatus(orderId)) ?? "pending";
    const history = await orderLifecycleModule.getStatusHistory(orderId);
    const currentStatusSince =
        history.length > 0
            ? new Date(history[history.length - 1].created_at as string).toISOString()
            : null;
    const timeline = await orderLifecycleModule.buildTimeline(orderId, {
        includeInternal: true,
    });
    const proofs = await orderLifecycleModule.getDeliveryProofs(orderId);
    const refunds = await orderLifecycleModule.getRefunds(orderId);
    const reschedules = await orderLifecycleModule.getRescheduleRequests(orderId);
    const assignments = await orderLifecycleModule.listStaffAssignments(orderId);
    const notes = await orderLifecycleModule.listNotes(orderId, { note_type: "all" });

    return res.status(200).json({
        order: {
            ...order,
            lifecycle_status: currentStatus,
            current_status_since: currentStatusSince,
            status_history: history,
            timeline,
            delivery_proofs: proofs,
            refunds,
            reschedule_requests: reschedules,
            staff_assignments: assignments,
            notes,
        },
    });
}

const transitionSchema = zod.object({
    to_status: zod.string().min(1),
    reason: zod.string().max(500).optional(),
});

/**
 * POST /admin/order-lifecycle/:id/transition
 * Admin — record a manual status transition for an order. Validates the
 * transition against the configurable adjacency map, emits a timeline event,
 * writes an audit log, and dispatches a customer notification (when a template
 * is configured for the new status).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = transitionSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid transition.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        getCurrentStatus: (orderId: string) => Promise<string | null>;
        recordStatusTransition: (
            input: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
    };
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        getValue: <T = string>(group: string, key: string) => Promise<T | null>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;

    const orderId = req.params.id;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    const actorType = "admin";

    const fromStatus = (await orderLifecycleModule.getCurrentStatus(orderId)) ?? "pending";

    let transitions: Record<string, string[]> | undefined;
    const configured = await settingsModule.getValue<string>("order_lifecycle", "transitions");
    if (configured) {
        try {
            transitions = JSON.parse(configured as string) as Record<string, string[]>;
        } catch {
            transitions = undefined;
        }
    }

    try {
        await orderLifecycleModule.recordStatusTransition({
            order_id: orderId,
            from_status: fromStatus,
            to_status: parsed.data.to_status,
            actor_type: actorType,
            actor_id: actorId ?? null,
            reason: parsed.data.reason ?? null,
            ...(transitions ? { transitions } : {}),
        });
    } catch (err) {
        return res.status(409).json({
            message: (err as Error).message,
        });
    }

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: actorType,
        action: "order.status_transition",
        entity: "order",
        entity_id: orderId,
        metadata: {
            from: fromStatus,
            to: parsed.data.to_status,
            reason: parsed.data.reason ?? null,
        },
    });

    // Best-effort customer notification (no failure if no template configured).
    try {
        const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
        const { data: orders } = await query.graph({
            entity: "order",
            fields: ["id", "email"],
            filters: { id: orderId },
        });
        const email = (orders as Record<string, unknown>[])?.[0]?.email as string | undefined;
        if (email) {
            await notificationModule.sendByEvent(
                `order_${parsed.data.to_status}`,
                "email",
                email,
                { order_id: orderId, status: parsed.data.to_status }
            );
        }
    } catch {
        // Notification is best-effort; do not fail the transition.
    }

    return res.status(200).json({
        id: orderId,
        from_status: fromStatus,
        to_status: parsed.data.to_status,
    });
}
