import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { RULES_MODULE } from "../../../../../modules/rules";

/**
 * GET /admin/offers/:id/audit-logs
 * Returns the immutable audit history of changes to this specific coupon.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const actorId = (req as any).auth_context?.actor_id as string | undefined;
    if (!actorId) {
        return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
    }
    const rulesModule = req.scope.resolve(RULES_MODULE);

    try {
        const logs = await rulesModule.listOfferAuditLogs({ offer_id: req.params.id });
        return res.status(200).json({ logs, success: true });
    } catch (err: any) {
        return res.status(500).json({ message: err.message || "Failed to retrieve audit logs." });
    }
}
