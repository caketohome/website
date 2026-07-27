import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        updateRedirect: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    const redirect = await cmsModule.updateRedirect(req.params.id as string, req.body as never);
    return res.status(200).json({ redirect });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        deleteCmsRedirects: (ids: string[]) => Promise<void>;
    };
    await cmsModule.deleteCmsRedirects([req.params.id as string]);
    return res.status(204).end();
}
