import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import zod from "zod";

const noteSchema = zod.object({
    body: zod.string().min(1).max(2000),
});

/**
 * POST /store/orders/:id/notes
 * Customer-authenticated — add a customer-visible note to an order (e.g. a
 * delivery instruction or message to the bakery). Customers can only add
 * `customer`-type notes; internal notes are admin-only.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid note.",
            errors: parsed.error.flatten(),
        });
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        addNote: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

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

    const note = await orderLifecycleModule.addNote({
        order_id: orderId,
        note_type: "customer",
        body: parsed.data.body,
        author_type: "customer",
        author_id: customerId,
    });

    return res.status(201).json({ note });
}
