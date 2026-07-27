import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsTags: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const tags = await cmsModule.listCmsTags({});
    return res.status(200).json({ tags });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createTag: (name: string) => Promise<{ id: string }>;
    };
    const body = req.body as { name: string };
    if (!body.name) return res.status(400).json({ message: "name is required." });
    const tag = await cmsModule.createTag(body.name);
    return res.status(201).json({ tag });
}
