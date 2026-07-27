import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/newsletter
 * List newsletter subscribers with optional status filter.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.source) filters.source = req.query.source;
    const subscribers =
        await marketingModule.listNewsletterSubscribersDTO(filters);
    return res.status(200).json({ subscribers });
}

/**
 * POST /admin/marketing/newsletter
 * Manually add a subscriber (admin import).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const body = req.body as any;
    if (!body?.email) {
        return res.status(400).json({ message: "email is required" });
    }
    try {
        const subscriber = await marketingModule.subscribeNewsletter({
            ...body,
            source: body.source ?? "manual",
        });
        return res.status(200).json({ subscriber });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
