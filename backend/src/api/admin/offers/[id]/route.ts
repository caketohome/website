import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../modules/rules";

/**
 * GET /admin/offers/:id
 * Retrieve a single coupon with full details, restrictions, and stats.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        const offer = await rulesModule.retrieveOffer(req.params.id);
        const redemptions = await rulesModule.listOfferRedemptions({ offer_id: req.params.id }).catch(() => []);
        return res.status(200).json({ offer, redemptions, redemptions_count: redemptions.length });
    } catch {
        return res.status(404).json({ message: "Offer not found" });
    }
}

/**
 * POST or PUT /admin/offers/:id
 * Update all enterprise coupon fields, restrictions, and log audit trail.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    return handleUpdate(req, res);
}

export async function PUT(req: MedusaRequest, res: MedusaResponse) {
    return handleUpdate(req, res);
}

async function handleUpdate(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);
    const body = req.body as Record<string, any>;
    const updateData: Record<string, any> = {};

    const stringFields = [
        "name", "code", "type", "status", "start_time", "end_time", "timezone",
        "delivery_mode", "description", "customer_eligibility", "approval_status"
    ];
    for (const key of stringFields) {
        if (body[key] !== undefined) updateData[key] = body[key];
    }

    const numberFields = [
        "priority", "usage_limit", "per_customer_limit", "daily_limit", "monthly_limit",
        "min_order_value", "max_discount_value", "min_quantity"
    ];
    for (const key of numberFields) {
        if (body[key] !== undefined) {
            updateData[key] = body[key] === null || body[key] === "" ? null : Number(body[key]);
        }
    }

    const booleanFields = [
        "never_expires", "is_stackable", "is_public", "auto_apply",
        "exclude_discounted_items", "exclude_flash_sales"
    ];
    for (const key of booleanFields) {
        if (body[key] !== undefined) updateData[key] = Boolean(body[key]);
    }

    if (body.starts_at !== undefined) updateData.starts_at = body.starts_at ? new Date(body.starts_at) : null;
    if (body.ends_at !== undefined) updateData.ends_at = body.ends_at ? new Date(body.ends_at) : null;

    const jsonFields = [
        "conditions", "rewards", "metadata", "applicable_branches", "applicable_cities",
        "applicable_pincodes", "excluded_pincodes", "applicable_products", "applicable_categories",
        "applicable_flavors", "applicable_shapes", "applicable_weights", "allowed_customer_ids",
        "allowed_phones", "allowed_emails", "customer_tags", "allowed_payment_methods"
    ];
    for (const key of jsonFields) {
        if (body[key] !== undefined) {
            updateData[key] = body[key] === null ? null : (typeof body[key] === "string" ? body[key] : JSON.stringify(body[key]));
        }
    }

    try {
        const updated = await rulesModule.updateOffers({
            selector: { id: req.params.id },
            data: updateData,
        });

        // Audit Log
        await rulesModule.logOfferAction(req.params.id, "updated", actorId, (req as any).auth_context?.email, updateData, req.ip);

        return res.status(200).json({ offer: updated[0] || updated, success: true });
    } catch (err: any) {
        return res.status(400).json({ message: err.message || "Failed to update offer" });
    }
}

/**
 * DELETE /admin/offers/:id
 * Delete or archive coupon with audit logging.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        await rulesModule.deleteOffers([req.params.id]);
        await rulesModule.logOfferAction(req.params.id, "deleted", actorId, (req as any).auth_context?.email, {}, req.ip);
        return res.status(200).json({ id: req.params.id, deleted: true, success: true });
    } catch {
        return res.status(404).json({ message: "Offer not found" });
    }
}
