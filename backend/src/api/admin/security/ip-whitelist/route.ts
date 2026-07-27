import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SECURITY_MODULE } from "../../../../modules/security/service";

/**
 * POST /admin/security/ip-whitelist
 * Admin — Register a new trusted IP/subnet whitelist configuration.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { ip_address, description } = req.body as any;
  const securityService = req.scope.resolve(SECURITY_MODULE) as any;

  if (!ip_address) {
    return res.status(400).json({ message: "ip_address is required." });
  }

  try {
    const created = await securityService.createIpWhitelists([
      {
        ip_address,
        description: description || null,
        is_active: true,
      },
    ]);

    return res.status(201).json({ whitelist: created[0] });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
