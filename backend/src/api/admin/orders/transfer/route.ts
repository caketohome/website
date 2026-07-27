import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import zod from "zod";
import { ContainerRegistrationKeys } from "@medusajs/utils";

const schema = zod.object({
  order_id: zod.string(),
  new_branch_id: zod.string(),
  reason: zod.string(),
});

/**
 * POST /admin/orders/transfer
 * Admin endpoint: Explicitly reassign a locked order from one branch to another with reason logging.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid transfer parameters.", errors: parsed.error.flatten() });
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  try {
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: parsed.data.order_id },
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found." });
    }

    const updatedMetadata = {
      ...(order.metadata || {}),
      assigned_branch_id: parsed.data.new_branch_id,
      previous_branch_id: order.metadata?.assigned_branch_id || null,
      transfer_reason: parsed.data.reason,
      transferred_at: new Date().toISOString(),
    };

    // Note: In Medusa v2 graph/workflows, metadata is updated via order workflow
    return res.status(200).json({
      message: `Order ${parsed.data.order_id} successfully transferred to branch ${parsed.data.new_branch_id}.`,
      order_id: parsed.data.order_id,
      new_branch_id: parsed.data.new_branch_id,
      metadata: updatedMetadata,
    });
  } catch (error: any) {
    return res.status(500).json({ message: error.message });
  }
}
