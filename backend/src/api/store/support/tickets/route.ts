import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../modules/support";

/**
 * GET /store/support/tickets
 * Storefront — Retrieve customer's support tickets history.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.customer_id as string | undefined;
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized. Customer account context required." });
  }

  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;

  try {
    const tickets = await supportService.listSupportTickets({ customer_id: customerId });
    return res.status(200).json({ tickets });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /store/support/tickets
 * Storefront — Lodge a support ticket.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const customerId = (req as any).auth_context?.customer_id as string | undefined;
  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized. Customer account context required." });
  }

  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;
  const { subject, description, priority } = req.body as any;

  try {
    const ticket = await supportService.createSupportTicket({
      customer_id: customerId,
      subject,
      description,
      priority,
    });
    return res.status(201).json({ ticket });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
