import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsHomepageSections: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.language_code) filters.language_code = req.query.language_code;
    const sections = await cmsModule.listCmsHomepageSections(filters);
    return res.status(200).json({ sections });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createHomepageSection: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const body = req.body as Record<string, unknown>;
    if (!body.name || !body.section_type) {
        return res.status(400).json({ message: "name and section_type are required." });
    }
    const section = await cmsModule.createHomepageSection(body as never);
    return res.status(201).json({ section });
}
