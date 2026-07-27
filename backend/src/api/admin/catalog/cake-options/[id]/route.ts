import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CATALOG_MODULE } from "../../../../../modules/catalog";

/**
 * DELETE /admin/catalog/cake-options/:id
 * Delete a cake option configuration.
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const { id } = req.params;
    const catalogModule = req.scope.resolve(CATALOG_MODULE) as any;

    try {
        await catalogModule.deleteCakeOptions([id]);
        return res.status(200).json({ success: true, message: "Cake option deleted" });
    } catch (e) {
        console.error("Failed to delete cake option", e);
        return res.status(500).json({ message: "Failed to delete cake option" });
    }
}
