import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsNavigations: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.location) filters.location = req.query.location;
    if (req.query.language_code) filters.language_code = req.query.language_code;
    const navigations = await cmsModule.listCmsNavigations(filters);
    return res.status(200).json({ navigations });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createNavigation: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const body = req.body as Record<string, unknown>;
    if (!body.name || !body.location) {
        return res.status(400).json({ message: "name and location are required." });
    }
    const navigation = await cmsModule.createNavigation(body as never);
    return res.status(201).json({ navigation });
}
