import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsRedirects: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.is_active !== undefined) filters.is_active = req.query.is_active === "true";
    const redirects = await cmsModule.listCmsRedirects(filters);
    return res.status(200).json({ redirects });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createRedirect: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const body = req.body as Record<string, unknown>;
    if (!body.from_path || !body.to_url) {
        return res.status(400).json({ message: "from_path and to_url are required." });
    }
    const redirect = await cmsModule.createRedirect(body as never);
    return res.status(201).json({ redirect });
}
