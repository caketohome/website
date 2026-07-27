import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../../modules/support";

/**
 * POST /store/support/chat/sessions
 * Storefront — Initialize a customer live chat session.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;
  const customerId = (req as any).auth_context?.customer_id as string | undefined;

  try {
    const session = await supportService.createChatSession({
      customer_id: customerId,
    });
    return res.status(201).json({ session });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
