import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

/**
 * POST /admin/cms/homepage/reorder
 * Body: { ordered_ids: string[] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        reorderHomepageSections: (orderedIds: string[]) => Promise<void>;
    };
    const body = req.body as { ordered_ids?: string[] };
    if (!Array.isArray(body.ordered_ids)) {
        return res.status(400).json({ message: "ordered_ids array is required." });
    }
    await cmsModule.reorderHomepageSections(body.ordered_ids);
    return res.status(200).json({ success: true });
}
