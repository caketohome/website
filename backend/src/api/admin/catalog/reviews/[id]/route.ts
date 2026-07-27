import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

/**
 * DELETE /admin/catalog/reviews/:id
 * Delete a review (admin).
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as {
        deleteReview: (reviewId: string) => Promise<void>;
    };
    await catalogModule.deleteReview(req.params.id);
    return res.status(200).json({ deleted: true });
}
