import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../modules/support";

/**
 * GET /admin/support/tickets
 * Admin — List support tickets.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  const limit = Math.min(Math.max(1, req.query.limit ? Number(req.query.limit) : 20), 100);
  const offset = Math.max(0, req.query.offset ? Number(req.query.offset) : 0);

  try {
    const tickets = await supportService.listSupportTickets(req.filterableFields || {}, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    });
    return res.status(200).json({
      tickets,
      count: (tickets || []).length,
      limit,
      offset,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        hasNextPage: (tickets || []).length >= limit,
        hasPreviousPage: offset > 0,
      },
    });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
