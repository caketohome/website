import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../../modules/support";

/**
 * POST /store/support/tickets/:id/replies
 * Storefront — Reply to a support ticket.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.customer_id as string | undefined;
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized. Customer account context required." });
  }

  const { id } = req.params;
  const { message } = req.body as any;
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    const reply = await supportService.replyToTicket(id, "customer", message);
    return res.status(201).json({ reply });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
