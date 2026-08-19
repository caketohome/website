import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AUDIT_MODULE } from "../../../modules/audit";

/**
 * GET /admin/audit-logs
 * List audit logs with optional filters: actor_id, entity, entity_id, action.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const auditModule = req.scope.resolve(AUDIT_MODULE) as any;

    const filters: Record<string, unknown> = {};
    if (req.query.actor_id) filters.actor_id = req.query.actor_id;
    if (req.query.entity) filters.entity = req.query.entity;
    if (req.query.entity_id) filters.entity_id = req.query.entity_id;
    if (req.query.action) filters.action = req.query.action;

    const logs = await auditModule.query(filters);
    return res.status(200).json({ logs });
}
