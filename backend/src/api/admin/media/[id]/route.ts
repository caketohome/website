import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { MEDIA_MODULE } from "../../../../modules/media";

/**
 * GET /admin/media/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const mediaModule = req.scope.resolve(MEDIA_MODULE) as any;
    const media = await mediaModule.retrieveMedia(req.params.id);
    return res.status(200).json({ media });
}

/**
 * DELETE /admin/media/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const mediaModule = req.scope.resolve(MEDIA_MODULE) as any;
    await mediaModule.deleteMedia([req.params.id]);
    return res.status(200).json({ id: req.params.id, deleted: true });
}
