import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * GET /admin/offers/:id
 * Retrieve a single offer with its stats.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        const offer = await rulesModule.retrieveOffer(req.params.id);
        const stats = await rulesModule.getOfferStats(req.params.id);
        return res.status(200).json({ offer, stats });
    } catch {
        return res.status(404).json({ message: "Offer not found" });
    }
}

/**
 * POST /admin/offers/:id
 * Update an existing offer. Supports all configurable fields.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const body = req.body as Record<string, unknown>;

    const data: Record<string, unknown> = {};

    // Simple scalar fields
    const scalarFields = [
        "name",
        "code",
        "type",
        "status",
        "priority",
        "starts_at",
        "ends_at",
        "usage_limit",
        "per_customer_limit",
        "is_stackable",
        "is_public",
        "description",
    ];
    for (const key of scalarFields) {
        if (body[key] !== undefined) data[key] = body[key];
    }

    // JSON-serialized fields
    const jsonFields = [
        "conditions",
        "rewards",
        "branch_ids",
        "customer_segments",
        "metadata",
    ];
    for (const key of jsonFields) {
        if (body[key] !== undefined) {
            data[key] =
                body[key] === null ? null : JSON.stringify(body[key]);
        }
    }

    try {
        const offer = await rulesModule.updateOffers({
            selector: { id: req.params.id },
            data,
        });

        return res.status(200).json({ offer });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}

/**
 * DELETE /admin/offers/:id
 * Soft-delete an offer.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        await rulesModule.deleteOffers([req.params.id]);
        return res.status(200).json({ id: req.params.id, deleted: true });
    } catch {
        return res.status(404).json({ message: "Offer not found" });
    }
}
