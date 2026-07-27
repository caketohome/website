import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        updateHomepageSection: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    const section = await cmsModule.updateHomepageSection(req.params.id as string, req.body as never);
    return res.status(200).json({ section });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        deleteCmsHomepageSections: (ids: string[]) => Promise<void>;
    };
    await cmsModule.deleteCmsHomepageSections([req.params.id as string]);
    return res.status(204).end();
}
