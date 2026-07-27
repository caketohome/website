import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CRM_MODULE } from "../../../../../modules/crm";

/**
 * GET /admin/crm/segments/:id
 * Admin — Retrieve a CRM segment details with customer count.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    const segment = await crmService.getSegment(id);
    const mappings = await crmService.listCustomerSegments({ segment_id: id });
    return res.status(200).json({
      segment: {
        ...segment,
        rules: segment.rules ? JSON.parse(segment.rules) : [],
        metadata: segment.metadata ? JSON.parse(segment.metadata) : null,
        customer_count: mappings.length,
      }
    });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * POST /admin/crm/segments/:id
 * Admin — Update a CRM segment properties.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;
  const payload = req.body as any;

  try {
    const segment = await crmService.updateSegment(id, payload);
    return res.status(200).json({ segment });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}

/**
 * PATCH /admin/crm/segments/:id
 * Admin — Update a CRM segment properties.
 */
export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  return POST(req, res);
}

/**
 * DELETE /admin/crm/segments/:id
 * Admin — Delete a CRM segment.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  const actorId = (req as any).auth_context?.actor_id as string | undefined;
  if (!actorId) {
    return res.status(401).json({ message: "Unauthorized. Admin credentials required." });
  }

  const { id } = req.params;
  const crmService = req.scope.resolve(CRM_MODULE) as any;

  try {
    await crmService.deleteSegment(id);
    return res.status(200).json({ id, deleted: true });
  } catch (error: any) {
    const status = error.status || 500;
    return res.status(status).json({ message: error.message, code: error.code });
  }
}
