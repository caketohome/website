import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MARKETING_MODULE } from "../../../../modules/marketing";

/**
 * GET /admin/marketing/qr-codes
 * List all QR code promotions.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.campaign_id) filters.campaign_id = req.query.campaign_id;
    const qrCodes = await marketingModule.listQRCodesDTO(filters);
    return res.status(200).json({ qr_codes: qrCodes });
}

/**
 * POST /admin/marketing/qr-codes
 * Create a new QR code promotion. Auto-generates a unique short code if
 * `code` is omitted.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const marketingModule = req.scope.resolve(MARKETING_MODULE) as any;
    const body = req.body as any;
    if (!body?.name) {
        return res.status(400).json({ message: "name is required" });
    }
    try {
        const qrCode = await marketingModule.createQRCode(body);
        return res.status(200).json({ qr_code: qrCode });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return res.status(400).json({ message });
    }
}
