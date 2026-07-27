import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../modules/rules";

/**
 * GET /admin/offers
 * List all offers with optional filters: status, type, is_public, code.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);
    const filters: Record<string, unknown> = {};

    if (req.query.status) filters.status = req.query.status;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.is_public !== undefined)
        filters.is_public = req.query.is_public === "true";
    if (req.query.code) filters.code = req.query.code;

    const offers = await rulesModule.listOffers(filters);
    return res.status(200).json({ offers });
}

/**
 * POST /admin/offers
 * Create a new offer with full validation.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const body = req.body as {
        name: string;
        code?: string;
        type: string;
        status?: string;
        priority?: number;
        starts_at?: Date;
        ends_at?: Date;
        usage_limit?: number;
        per_customer_limit?: number;
        is_stackable?: boolean;
        is_public?: boolean;
        description?: string;
        conditions?: unknown[];
        rewards?: unknown[];
        branch_ids?: string[];
        customer_segments?: string[];
        metadata?: Record<string, unknown>;
    };

    if (!body.name || !body.type) {
        return res.status(400).json({ message: "name and type are required" });
    }

    const offer = await rulesModule.createOffers({
        name: body.name,
        code: body.code ?? null,
        type: body.type,
        status: body.status ?? "draft",
        priority: body.priority ?? 0,
        starts_at: body.starts_at ?? null,
        ends_at: body.ends_at ?? null,
        usage_limit: body.usage_limit ?? null,
        per_customer_limit: body.per_customer_limit ?? null,
        is_stackable: body.is_stackable ?? false,
        is_public: body.is_public ?? true,
        description: body.description ?? null,
        conditions: body.conditions ? JSON.stringify(body.conditions) : null,
        rewards: body.rewards ? JSON.stringify(body.rewards) : null,
        branch_ids: body.branch_ids ? JSON.stringify(body.branch_ids) : null,
        customer_segments: body.customer_segments
            ? JSON.stringify(body.customer_segments)
            : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : null,
        total_redemptions: 0,
    });

    return res.status(200).json({ offer });
}
