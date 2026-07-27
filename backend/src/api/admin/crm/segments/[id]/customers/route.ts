import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * GET /admin/crm/segments/:id/customers
 * Admin — List customers matching segment criteria.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const customerModule = req.scope.resolve("customerModuleService") || req.scope.resolve("customer") as any;

  try {
    const mappings = await crmService.listCustomerSegments({ segment_id: id });
    const customerIds = mappings.map((m: any) => m.customer_id);

    if (customerIds.length === 0) {
      return res.status(200).json({ customers: [] });
    }

    const customers = await customerModule.listCustomers({ id: customerIds });
    return res.status(200).json({ customers });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
