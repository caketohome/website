import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SECURITY_MODULE } from "../../../../modules/security/service";

/**
 * GET /admin/security/logs
 * Admin — Fetch audit logs, blocked IPs, and security event histories.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const securityService = req.scope.resolve(SECURITY_MODULE) as any;
  const auditService = req.scope.resolve("auditModuleService") as any;

  const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
  const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);
  const paginationConfig = {
    take: limit,
    skip: offset,
    order: { created_at: "DESC" },
  };

  try {
    const logs = await auditService.listAuditLogs({}, paginationConfig);
    const events = await securityService.listSecurityEvents({}, paginationConfig);
    const blocks = await securityService.listBlockedIps();
    const whitelists = await securityService.listIpWhitelists();

    return res.status(200).json({
      logs,
      events,
      blocks,
      whitelists,
      limit,
      offset,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasNextPage: (logs || []).length >= limit || (events || []).length >= limit,
        hasPreviousPage: offset > 0,
      },
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
