import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../modules/support";

/**
 * GET /admin/support/contact-submissions
 * Admin — List contact submissions.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    const submissions = await supportService.listContactSubmissions(req.filterableFields || {});
    return res.status(200).json({ submissions });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
