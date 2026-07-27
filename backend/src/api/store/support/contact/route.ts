import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { SUPPORT_MODULE } from "../../../../modules/support";

/**
 * POST /store/support/contact
 * Storefront — Submit contact us form.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const supportService = req.scope.resolve(SUPPORT_MODULE) as any;
  const payload = req.body as any;

  try {
    const submission = await supportService.createContactSubmission(payload);
    return res.status(201).json({ submission });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
