import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../modules/catalog";
import { SETTINGS_MODULE } from "../../../modules/settings";
import zod from "zod";

/**
 * GET /store/subscriptions
 * Customer-authenticated — list the authenticated customer's subscriptions.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("subscriptions"))) {
        return res.status(403).json({ message: "Subscriptions are not enabled." });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        listSubscriptions: (filters: Record<string, unknown>, config?: Record<string, unknown>) => Promise<unknown[]>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const filters: Record<string, unknown> = {
        customer_id: customerId,
    };
    if (req.query.status) {
        filters.status = req.query.status as string;
    }

    const config: Record<string, unknown> = {
        take: limit,
        skip: offset,
    };

    const subscriptions = await catalogModule.listSubscriptions(filters, config);
    return res.status(200).json({ subscriptions });
}

const createSchema = zod.object({
    product_id: zod.string().min(1),
    variant_id: zod.string().optional(),
    frequency: zod.enum(["weekly", "fortnightly", "monthly", "custom"]).optional(),
    quantity: zod.number().int().min(1).optional(),
    next_date: zod.string(),
    max_deliveries: zod.number().int().min(1).nullable().optional(),
});

/**
 * POST /store/subscriptions
 * Customer-authenticated — create a product subscription.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const settingsModule = req.scope.resolve(SETTINGS_MODULE) as {
        isFeatureEnabled: (key: string) => Promise<boolean>;
    };
    if (!(await settingsModule.isFeatureEnabled("subscriptions"))) {
        return res.status(403).json({ message: "Subscriptions are not enabled." });
    }

    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid subscription.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        createSubscription: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };
    const customerId = (req as any).auth_context?.actor_id as string;

    const subscription = await catalogModule.createSubscription({
        customer_id: customerId,
        product_id: parsed.data.product_id,
        variant_id: parsed.data.variant_id ?? null,
        frequency: parsed.data.frequency ?? "monthly",
        quantity: parsed.data.quantity ?? 1,
        next_date: parsed.data.next_date,
        max_deliveries: parsed.data.max_deliveries ?? null,
    });

    return res.status(201).json({ subscription });
}
