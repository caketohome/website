import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";

/**
 * GET /admin/marketing/popups/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        const popup = await marketingModule.retrievePopupDTO(req.params.id);
        return res.status(200).json({ popup });
    } catch {
        return res.status(404).json({ message: "Popup not found" });
    }
}

/**
 * POST /admin/marketing/popups/:id
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        const popup = await marketingModule.updatePopup(req.params.id, req.body as any);
        return res.status(200).json({ popup });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}

/**
 * DELETE /admin/marketing/popups/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        await marketingModule.deletePopup(req.params.id);
        return res.status(200).json({ id: req.params.id, deleted: true });
    } catch {
        return res.status(404).json({ message: "Popup not found" });
    }
}
