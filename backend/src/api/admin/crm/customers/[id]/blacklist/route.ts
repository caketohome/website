import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { CRM_MODULE } from "../../../../../../modules/crm";

/**
 * POST /admin/crm/customers/:id/blacklist
 * Admin — Blacklist a customer account.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const { reason } = req.body as { reason?: string };

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    // Verify customer exists
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      filters: { id },
      fields: ["id"],
    });

    if (!customer) {
      return res.status(404).json({ message: `Customer with ID ${id} not found.` });
    }

    const record = await crmService.blacklistCustomer(id, reason || null, actorId);
    return res.status(201).json({ blacklist: record });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * DELETE /admin/crm/customers/:id/blacklist
 * Admin — Remove a customer from the blacklist.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    // Verify customer exists
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      filters: { id },
      fields: ["id"],
    });

    if (!customer) {
      return res.status(404).json({ message: `Customer with ID ${id} not found.` });
    }

    await crmService.removeCustomerFromBlacklist(id);
    return res.status(200).json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}

/**
 * GET /admin/crm/customers/:id/blacklist
 * Admin — Retrieve a customer's blacklist status details.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    // Verify customer exists
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      filters: { id },
      fields: ["id"],
    });

    if (!customer) {
      return res.status(404).json({ message: `Customer with ID ${id} not found.` });
    }

    const [record] = await crmService.listCustomerBlacklists({ customer_id: id });
    return res.status(200).json({
      is_blacklisted: record ? !!record.is_blacklisted : false,
      blacklist: record || null,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
