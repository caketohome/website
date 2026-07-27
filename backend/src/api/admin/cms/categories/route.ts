import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsCategories: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const categories = await cmsModule.listCmsCategories({});
    return res.status(200).json({ categories });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createCategory: (name: string, slug?: string, parentId?: string | null) => Promise<{ id: string }>;
    };
    const body = req.body as { name: string; slug?: string; parent_id?: string };
    if (!body.name) return res.status(400).json({ message: "name is required." });
    const category = await cmsModule.createCategory(body.name, body.slug, body.parent_id ?? null);
    return res.status(201).json({ category });
}
