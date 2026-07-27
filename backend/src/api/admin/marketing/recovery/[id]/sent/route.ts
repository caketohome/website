import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../../modules/marketing";

/**
 * POST /admin/marketing/recovery/:id/sent
 * Mark a recovery job as dispatched.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        const job = await marketingModule.markRecoveryJobSent(req.params.id);
        return res.status(200).json({ job });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
