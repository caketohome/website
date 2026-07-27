import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../modules/catalog";
import zod from "zod";

const schema = zod
    .object({
        product_id: zod.string().min(1),
        variant_id: zod.string().optional(),
        email: zod.string().email().optional(),
        phone: zod.string().optional(),
    })
    .refine((d) => d.email || d.phone, {
        message: "Either email or phone is required for guest stock notifications.",
    });

/**
 * POST /store/stock-notifications
 * Public (guests by email/phone) or customer-authenticated.
 *
 * Registers a "notify me when back in stock" request. The restock workflow
 * (Phase 6) or an admin action dispatches a notification via the Notification
 * Module (M6) and marks the request as notified.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res
            .status(400)
            .json({ message: "Invalid stock notification request.", errors: parsed.error.flatten() });
    }

    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        createStockNotification: (input: Record<string, unknown>) => Promise<Record<string, unknown>>;
    };

    const customerId = ((req as any).auth_context?.actor_id as string | undefined) ?? null;

    const notification = await catalogModule.createStockNotification({
        product_id: parsed.data.product_id,
        variant_id: parsed.data.variant_id ?? null,
        customer_id: customerId,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
    });

    return res.status(201).json({ notification });
}
