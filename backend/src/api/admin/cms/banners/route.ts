import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsBanners: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.language_code) filters.language_code = req.query.language_code;
    const banners = await cmsModule.listCmsBanners(filters);
    return res.status(200).json({ banners });
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createBanner: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const body = req.body as Record<string, unknown>;
    if (!body.image_url) {
        return res.status(400).json({ message: "image_url is required." });
    }
    const banner = await cmsModule.createBanner(body as never);
    return res.status(201).json({ banner });
}
