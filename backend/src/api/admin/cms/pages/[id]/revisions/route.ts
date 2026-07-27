import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../../modules/cms";

/**
 * GET /admin/cms/pages/:id/revisions
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listRevisions: (pageId: string) => Promise<unknown[]>;
    };
    const revisions = await cmsModule.listRevisions(req.params.id as string);
    return res.status(200).json({ revisions });
}
