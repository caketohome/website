import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsPages: (filters: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
    };
    const [page] = await cmsModule.listCmsPages({ id: req.params.id });
    if (!page) return res.status(404).json({ message: "Page not found." });
    return res.status(200).json({ page });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        updatePage: (id: string, input: Record<string, unknown>) => Promise<unknown>;
    };
    const page = await cmsModule.updatePage(req.params.id as string, req.body as never);
    return res.status(200).json({ page });
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        deleteCmsPages: (ids: string[]) => Promise<void>;
    };
    await cmsModule.deleteCmsPages([req.params.id as string]);
    return res.status(204).end();
}
