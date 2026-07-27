import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/recovery
 * List recovery jobs (abandoned cart / wishlist / recently-viewed) with
 * optional filters: type, stage, customer_id, cart_id.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.type) filters.type = req.query.type;
    if (req.query.stage) filters.stage = req.query.stage;
    if (req.query.customer_id) filters.customer_id = req.query.customer_id;
    if (req.query.cart_id) filters.cart_id = req.query.cart_id;
    const jobs = await marketingModule.listRecoveryJobsDTO(filters);
    return res.status(200).json({ jobs });
}

/**
 * POST /admin/marketing/recovery
 * Manually create a recovery job (admin-triggered).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const body = req.body as any;
    if (!body?.type) {
        return res.status(400).json({ message: "type is required" });
    }
    try {
        const job = await marketingModule.createRecoveryJob(body);
        return res.status(200).json({ job });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
