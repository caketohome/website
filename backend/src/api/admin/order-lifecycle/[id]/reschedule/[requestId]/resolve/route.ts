import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../../../modules/order-lifecycle";
import { AUDIT_MODULE } from "../../../../../../../modules/audit";
import zod from "zod";

const resolveSchema = zod.object({
    status: zod.enum(["approved", "rejected"]),
    resolution_note: zod.string().max(500).optional(),
});

/**
 * POST /admin/order-lifecycle/:id/reschedule/:requestId/resolve
 * Admin — approve or reject a reschedule request. On approval, the order's
 * delivery slot/date is updated (coordinated with the Delivery module by the
 * caller) and a timeline event is recorded.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid resolution.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        resolveRescheduleRequest: (
            requestId: string,
            resolution: Record<string, unknown>
        ) => Promise<Record<string, unknown>>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const { id: orderId, requestId } = req.params;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;

    const result = await orderLifecycleModule.resolveRescheduleRequest(requestId, {
        status: parsed.data.status,
        resolved_by_type: "admin",
        resolved_by_id: actorId ?? null,
        resolution_note: parsed.data.resolution_note ?? null,
    });

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: "admin",
        action: "order.reschedule_resolved",
        entity: "order",
        entity_id: orderId,
        metadata: { request_id: requestId, status: parsed.data.status },
    });

    return res.status(200).json(result);
}
