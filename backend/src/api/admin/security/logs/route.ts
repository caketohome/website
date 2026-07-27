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

  try {
    const logs = await auditService.listAuditLogs();
    const events = await securityService.listSecurityEvents();
    const blocks = await securityService.listBlockedIps();
    const whitelists = await securityService.listIpWhitelists();

    return res.status(200).json({ logs, events, blocks, whitelists });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
