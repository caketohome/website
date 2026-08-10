import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../../modules/rules";

/**
 * POST /admin/offers/:id/clone
 * Duplicate an existing coupon into a new draft with a fresh code.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        const source = await rulesModule.retrieveOffer(req.params.id);
        const rand = Math.floor(1000 + Math.random() * 9000);
        const clonedCode = source.code ? `${source.code}_COPY_${rand}` : `COUPON_${rand}`;

        const cloneData = {
            ...source,
            name: `${source.name} (Copy)`,
            code: clonedCode,
            status: "draft",
            approval_status: "draft",
            total_redemptions: 0,
            total_discount_given: 0,
            total_revenue_generated: 0,
            created_by: actorId,
        };
        delete (cloneData as any).id;
        delete (cloneData as any).created_at;
        delete (cloneData as any).updated_at;

        const created = await rulesModule.createOffers(cloneData);
        const clonedOffer = created[0] || created;

        await rulesModule.logOfferAction(clonedOffer.id, "cloned", actorId, (req as any).auth_context?.email, { source_id: req.params.id }, req.ip);

        return res.status(201).json({ offer: clonedOffer, success: true });
    } catch (err: any) {
        return res.status(400).json({ message: err.message || "Failed to clone coupon." });
    }
}
