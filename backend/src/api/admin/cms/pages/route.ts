import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

/**
 * GET /admin/cms/pages
 * List CMS pages with optional filters: status, type, lang.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listCmsPages: (filters: Record<string, unknown>) => Promise<unknown[]>;
    };
    const filters: Record<string, unknown> = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.type) filters.type = req.query.type;
    if (req.query.language_code) filters.language_code = req.query.language_code;

    const pages = await cmsModule.listCmsPages(filters);
    return res.status(200).json({ pages });
}

/**
 * POST /admin/cms/pages
 * Create a CMS page.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        createPage: (input: Record<string, unknown>) => Promise<{ id: string }>;
    };
    const body = req.body as Record<string, unknown>;

    if (!body.slug || !body.title) {
        return res.status(400).json({ message: "slug and title are required." });
    }

    const page = await cmsModule.createPage(body as never);
    return res.status(201).json({ page });
}
