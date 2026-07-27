import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../modules/crm";

/**
 * PATCH /admin/crm/notes/:noteId
 * Admin — Update a customer note body.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { noteId } = req.params;
  const { body } = req.body as { body?: string };

  if (!body || !body.trim()) {
    return res.status(400).json({ message: "Body is required to update a note." });
  }

  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const note = await crmService.updateNote(noteId, body.trim(), actorId);
    return res.status(200).json({ note });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * DELETE /admin/crm/notes/:noteId
 * Admin — Soft-delete a customer note.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { noteId } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    await crmService.deleteNote(noteId, actorId);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
