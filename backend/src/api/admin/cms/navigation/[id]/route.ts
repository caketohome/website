import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        updateNavigation: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    const navigation = await cmsModule.updateNavigation(req.params.id as string, req.body as never);
    return res.status(200).json({ navigation });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        deleteCmsNavigations: (ids: string[]) => Promise<void>;
    };
    await cmsModule.deleteCmsNavigations([req.params.id as string]);
    return res.status(204).end();
}
