import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

/**
 * GET /admin/cms/seo
 * Returns an aggregated SEO health overview for the admin SEO Dashboard:
 * page inventory, meta coverage, blog counts, redirects, homepage sections,
 * banners, and navigations.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        getSeoOverview: () => Promise<unknown>;
    };

    const overview = await cmsModule.getSeoOverview();
    return res.status(200).json({ overview });
}
