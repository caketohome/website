import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../../modules/catalog";
import { ANALYTICS_MODULE } from "../../../../../../modules/analytics";
import { SETTINGS_MODULE } from "../../../../../../modules/settings";
import zod from "zod";

const schema = zod.object({
    product_id: zod.string().min(1),
    rating: zod.number().int().min(1).max(5),
    title: zod.string().max(120).optional(),
    body: zod.string().max(5000).optional(),
    images: zod.array(zod.string().url()).max(5).optional(),
});

/**
 * POST /store/products/:id/reviews
 * Customer-authenticated — submit a product review.
 *
 * The review is created with status "pending" and requires admin moderation
 * before it appears on the storefront. The `reviews` feature flag must be
 * enabled (Settings Module M1).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };

    if (!(await settingsModule.isFeatureEnabled("reviews"))) {
        return res.status(403).json({ message: "Reviews are not enabled." });
    }

    const parsed = schema.safeParse({
        ...(req.body as Record<string, unknown>),
        product_id: req.params.id,
    });
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid review.", errors: parsed.error.flatten() });
    }

    const customerId = (req as any).auth_context?.actor_id as string | undefined;
    if (!customerId) {
        return res.status(401).json({ message: "Authentication required to submit a review." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        createReview: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

    const review = await catalogModule.createReview({
        product_id: parsed.data.product_id,
        customer_id: customerId,
        rating: parsed.data.rating,
        title: parsed.data.title ?? null,
        body: parsed.data.body ?? null,
        images: parsed.data.images ?? null,
    });

    // Track review submission (best-effort).
    try {
        const analyticsModule = req.scope.resolve(ANALYTICS_MODULE) as any;
        await analyticsModule.track({
            event_type: "review_submitted",
            entity_id: parsed.data.product_id,
            customer_id: customerId,
            payload: { rating: parsed.data.rating },
        });
    } catch {
        // best-effort
    }

    return res.status(201).json({ review });
}
