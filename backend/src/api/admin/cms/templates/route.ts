import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsTemplates: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.type) filters.type = req.query.type;
    const templates = await cmsModule.listCmsTemplates(filters);
    return res.status(200).json({ templates });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createTemplate: (
            name: string,
            type: string,
            structure: unknown,
            description?: string | null
        ) => Promise<{ id: string }>;
    };
    const body = req.body as {
        name: string;
        type?: string;
        structure?: unknown;
        description?: string;
    };
    if (!body.name) return res.status(400).json({ message: "name is required." });
    const template = await cmsModule.createTemplate(
        body.name,
        body.type ?? "page",
        body.structure,
        body.description ?? null
    );
    return res.status(201).json({ template });
}
