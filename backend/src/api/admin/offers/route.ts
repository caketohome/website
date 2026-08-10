import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../modules/rules";

/**
 * GET /admin/offers
 * List all offers/coupons with multi-dimensional filtering, pagination, and sorting.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    const query = req.query || {};
    const filters: Record<string, unknown> = {};

    if (query.status && query.status !== "all") filters.status = query.status;
    if (query.type && query.type !== "all") filters.type = query.type;
    if (query.is_public !== undefined && query.is_public !== "all") {
        filters.is_public = query.is_public === "true";
    }

    const allOffers = await rulesModule.listOffers(filters);
    let results = (allOffers as any[]) || [];

    // Filter by Search Query
    if (query.q) {
        const search = String(query.q).toLowerCase().trim();
        results = results.filter(
            (o) =>
                (o.name && o.name.toLowerCase().includes(search)) ||
                (o.code && o.code.toLowerCase().includes(search)) ||
                (o.description && o.description.toLowerCase().includes(search))
        );
    }

    // Filter by Branch
    if (query.branch_id && query.branch_id !== "all") {
        results = results.filter((o) => {
            if (!o.applicable_branches) return true;
            try {
                const branches = Array.isArray(o.applicable_branches)
                    ? o.applicable_branches
                    : JSON.parse(o.applicable_branches);
                return branches.includes("all") || branches.includes(query.branch_id);
            } catch {
                return true;
            }
        });
    }

    // Filter by City
    if (query.city && query.city !== "all") {
        results = results.filter((o) => {
            if (!o.applicable_cities) return true;
            try {
                const cities = Array.isArray(o.applicable_cities)
                    ? o.applicable_cities
                    : JSON.parse(o.applicable_cities);
                return cities.includes("all") || cities.map((c: string) => c.toLowerCase()).includes(String(query.city).toLowerCase());
            } catch {
                return true;
            }
        });
    }

    // Server-side Pagination
    const page = parseInt(String(query.page || "1"), 10);
    const limit = parseInt(String(query.limit || "50"), 10);
    const total = results.length;
    const startIndex = (page - 1) * limit;
    const paginated = results.slice(startIndex, startIndex + limit);

    return res.status(200).json({
        offers: paginated,
        count: total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
    });
}

/**
 * POST /admin/offers
 * Create a new enterprise coupon with full validation, restriction mappings, and audit log.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);
    const body = req.body as any;

    if (!body.name || !body.type) {
        return res.status(400).json({ message: "name and type are required fields." });
    }

    const formattedCode = body.code ? String(body.code).trim().toUpperCase() : null;

    const offerData = {
        name: body.name.trim(),
        code: formattedCode,
        type: body.type,
        status: body.status || "active",
        priority: Number(body.priority) || 0,
        starts_at: body.starts_at ? new Date(body.starts_at) : null,
        ends_at: body.ends_at ? new Date(body.ends_at) : null,
        start_time: body.start_time || null,
        end_time: body.end_time || null,
        timezone: body.timezone || "Asia/Kolkata",
        never_expires: Boolean(body.never_expires),
        usage_limit: body.usage_limit ? Number(body.usage_limit) : null,
        per_customer_limit: body.per_customer_limit !== undefined ? Number(body.per_customer_limit) : 1,
        daily_limit: body.daily_limit ? Number(body.daily_limit) : null,
        monthly_limit: body.monthly_limit ? Number(body.monthly_limit) : null,
        is_stackable: Boolean(body.is_stackable),
        is_public: body.is_public !== undefined ? Boolean(body.is_public) : true,
        auto_apply: Boolean(body.auto_apply),
        delivery_mode: body.delivery_mode || "all",
        allowed_payment_methods: body.allowed_payment_methods ? JSON.stringify(body.allowed_payment_methods) : null,
        min_order_value: Number(body.min_order_value) || 0,
        max_discount_value: body.max_discount_value ? Number(body.max_discount_value) : null,
        min_quantity: Number(body.min_quantity) || 1,
        description: body.description || null,
        applicable_branches: body.applicable_branches ? JSON.stringify(body.applicable_branches) : null,
        applicable_cities: body.applicable_cities ? JSON.stringify(body.applicable_cities) : null,
        applicable_pincodes: body.applicable_pincodes ? JSON.stringify(body.applicable_pincodes) : null,
        excluded_pincodes: body.excluded_pincodes ? JSON.stringify(body.excluded_pincodes) : null,
        applicable_products: body.applicable_products ? JSON.stringify(body.applicable_products) : null,
        applicable_categories: body.applicable_categories ? JSON.stringify(body.applicable_categories) : null,
        applicable_flavors: body.applicable_flavors ? JSON.stringify(body.applicable_flavors) : null,
        applicable_shapes: body.applicable_shapes ? JSON.stringify(body.applicable_shapes) : null,
        applicable_weights: body.applicable_weights ? JSON.stringify(body.applicable_weights) : null,
        customer_eligibility: body.customer_eligibility || "all",
        allowed_customer_ids: body.allowed_customer_ids ? JSON.stringify(body.allowed_customer_ids) : null,
        allowed_phones: body.allowed_phones ? JSON.stringify(body.allowed_phones) : null,
        allowed_emails: body.allowed_emails ? JSON.stringify(body.allowed_emails) : null,
        customer_tags: body.customer_tags ? JSON.stringify(body.customer_tags) : null,
        exclude_discounted_items: Boolean(body.exclude_discounted_items),
        exclude_flash_sales: Boolean(body.exclude_flash_sales),
        approval_status: body.approval_status || "approved",
        created_by: actorId,
        conditions: body.conditions ? JSON.stringify(body.conditions) : null,
        rewards: body.rewards ? JSON.stringify(body.rewards) : null,
        metadata: body.metadata ? JSON.stringify(body.metadata) : JSON.stringify({ discount_value: body.discount_value || 10 }),
    };

    const created = await rulesModule.createOffers(offerData);
    const offer = created[0] || created;

    // Log Audit
    await rulesModule.logOfferAction(offer.id, "created", actorId, (req as any).auth_context?.email, offerData, req.ip);

    return res.status(201).json({ offer, success: true });
}
