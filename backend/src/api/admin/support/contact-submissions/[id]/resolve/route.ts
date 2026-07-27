import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../../modules/support";

/**
 * POST /admin/support/contact-submissions/:id/resolve
 * Admin — Mark a contact submission Resolved.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    const submission = await supportService.resolveContactSubmission(id);
    return res.status(200).json({ submission });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
