import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * GET /admin/crm/customers/:id/notes
 * Admin — Retrieve list of internal notes for a customer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const notes = await crmService.listNotes(id);
    return res.status(200).json({ notes });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/customers/:id/notes
 * Admin — Add an internal note to a customer profile.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const { body } = req.body as { body?: string };

  if (!body || !body.trim()) {
    return res.status(400).json({ message: "Body is required to create a note." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const note = await crmService.createNote(id, body.trim(), actorId);
    return res.status(201).json({ note });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
