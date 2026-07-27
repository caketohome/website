import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../../modules/marketing";

/**
 * GET /admin/marketing/qr-codes/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        const qrCode = await marketingModule.retrieveQRCodeDTO(req.params.id);
        return res.status(200).json({ qr_code: qrCode });
    } catch {
        return res.status(404).json({ message: "QR code not found" });
    }
}

/**
 * DELETE /admin/marketing/qr-codes/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    try {
        await marketingModule.deleteQRCode(req.params.id);
        return res.status(200).json({ id: req.params.id, deleted: true });
    } catch {
        return res.status(404).json({ message: "QR code not found" });
    }
}
