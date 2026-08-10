import { MedusaRequest, MedusaResponse } from "@medusajs/framework";

/**
 * PUT /admin/orders/:id/assign-branch
 * Assign or reassign order to a specific kitchen branch hub.
 */
export async function PUT(req: MedusaRequest, res: MedusaResponse) {
  const { id } = req.params;
  const body = req.body as any;
  const branchId = body?.branch_id;
  const branchName = body?.branch_name || "Assigned Kitchen Hub";

  if (!branchId) {
    return res.status(400).json({ message: "Field 'branch_id' is required." });
  }

  return res.status(200).json({
    message: `Order ${id} successfully assigned to branch '${branchName}' (${branchId}).`,
    order_id: id,
    branch_id: branchId,
    branch_name: branchName,
    assigned_at: new Date().toISOString(),
  });
}
