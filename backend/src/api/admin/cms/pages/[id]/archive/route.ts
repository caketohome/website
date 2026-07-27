import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../../modules/cms";

/**
 * POST /admin/cms/pages/:id/archive
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        archivePage: (id: string) => Promise<unknown>;
    };
    const result = await cmsModule.archivePage(req.params.id as string);
    return res.status(200).json({ result });
}
