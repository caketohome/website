import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { AUDIT_MODULE } from "../../../../modules/audit";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const auditService = req.scope.resolve(AUDIT_MODULE) as any;

  try {
    const logs = await auditService.listConfigAuditLogs({}, {
      order: {
        created_at: "DESC",
      },
    });
    return res.status(200).json({ logs });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
