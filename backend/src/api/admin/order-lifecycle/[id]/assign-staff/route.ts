import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const assignSchema = zod.object({
    role: zod.string().min(1),
    staff_id: zod.string().min(1),
    staff_name: zod.string().optional(),
});

/**
 * POST /admin/order-lifecycle/:id/assign-staff
 * Admin — assign a staff member to an order for accountability (baker, packer,
 * delivery partner, branch manager, etc.). Supersedes any existing active
 * assignment for the same role.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = assignSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid assignment.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        assignStaff: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;

    const assignment = await orderLifecycleModule.assignStaff({
        order_id: orderId,
        role: parsed.data.role,
        staff_id: parsed.data.staff_id,
        staff_name: parsed.data.staff_name ?? null,
        assigned_by_type: "admin",
        assigned_by_id: actorId ?? null,
    });

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: "admin",
        action: "order.staff_assigned",
        entity: "order",
        entity_id: orderId,
        metadata: { role: parsed.data.role, staff_id: parsed.data.staff_id },
    });

    return res.status(201).json({ assignment });
}
