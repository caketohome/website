import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        updateBanner: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    const banner = await cmsModule.updateBanner(req.params.id as string, req.body as never);
    return res.status(200).json({ banner });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        deleteCmsBanners: (ids: string[]) => Promise<void>;
    };
    await cmsModule.deleteCmsBanners([req.params.id as string]);
    return res.status(204).end();
}
