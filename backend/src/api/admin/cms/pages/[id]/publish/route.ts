import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../../modules/cms";

/**
 * POST /admin/cms/pages/:id/publish
 * Publish a page and create a revision snapshot.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        publishPage: (id: string, author?: string | null) => Promise<unknown>;
    };
    const body = (req.body as { author?: string }) ?? {};
    const result = await cmsModule.publishPage(req.params.id as string, body.author ?? null);
    return res.status(200).json({ result });
}
