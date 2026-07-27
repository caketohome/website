import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ORDER_LIFECYCLE_MODULE } from "../../../../../modules/order-lifecycle";
import { AUDIT_MODULE } from "../../../../../modules/audit";
import zod from "zod";

const proofSchema = zod.object({
    delivery_id: zod.string().optional(),
    delivery_partner_id: zod.string().optional(),
    photo_url: zod.string().optional(),
    signature_url: zod.string().optional(),
    note: zod.string().max(500).optional(),
    latitude: zod.number().optional(),
    longitude: zod.number().optional(),
    captured_at: zod.string().optional(),
});

/**
 * POST /admin/order-lifecycle/:id/proof
 * Admin — upload a delivery proof (photo + signature) for an order. Typically
 * used by delivery partners via the delivery dashboard, but exposed to admins
 * for manual entry. The photo/signature URLs reference Media Module (M10)
 * assets.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = proofSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({
            message: "Invalid proof.",
            errors: parsed.error.flatten(),
        });
    }

    const orderLifecycleModule = req.scope.resolve(ORDER_LIFECYCLE_MODULE) as {
        addDeliveryProof: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const orderId = req.params.id;
    const actorId = (req as any).auth_context?.actor_id as string | undefined;

    const proof = await orderLifecycleModule.addDeliveryProof({
        order_id: orderId,
        delivery_id: parsed.data.delivery_id ?? null,
        delivery_partner_id: parsed.data.delivery_partner_id ?? null,
        photo_url: parsed.data.photo_url ?? null,
        signature_url: parsed.data.signature_url ?? null,
        note: parsed.data.note ?? null,
        latitude: parsed.data.latitude ?? null,
        longitude: parsed.data.longitude ?? null,
        captured_at: parsed.data.captured_at ?? new Date().toISOString(),
    });

    await auditModule.log({
        actor_id: actorId ?? null,
        actor_type: "admin",
        action: "order.proof_uploaded",
        entity: "order",
        entity_id: orderId,
        metadata: { photo_url: parsed.data.photo_url ?? null },
    });

    return res.status(201).json({ proof });
}
