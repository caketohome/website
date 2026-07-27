import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const noteSchema = zod.object({
    note_type: zod.enum(["internal", "customer"]),
    body: zod.string().min(1).max(2000),
});

/**
 * POST /admin/order-lifecycle/:id/notes
 * Admin — add an internal or customer-visible note to an order.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid note.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        addNote: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as unknown as {
        log: (input: Record<string, unknown>) => Promise<void>;
    };

    const orderId = req.params.id;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;

    const note = await orderLifecycleModule.addNote({
        order_id: orderId,
        note_type: parsed.data.note_type,
        body: parsed.data.body,
        author_type: "admin",
        author_id: actorId ?? null,
    });

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: "admin",
        action: "order.note_added",
        entity: "order",
        entity_id: orderId,
        metadata: { note_type: parsed.data.note_type },
    });

    return res.status(201).json({ note });
}
