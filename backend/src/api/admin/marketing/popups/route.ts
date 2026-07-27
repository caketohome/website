import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/popups
 * List all marketing popups with optional status filter.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.trigger) filters.trigger = req.query.trigger;
    const popups = await marketingModule.listPopupsDTO(filters);
    return res.status(200).json({ popups });
}

/**
 * POST /admin/marketing/popups
 * Create a new marketing popup.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const body = req.body as any;
    if (!body?.name) {
        return res.status(400).json({ message: "name is required" });
    }
    try {
        const popup = await marketingModule.createPopup(body);
        return res.status(200).json({ popup });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
