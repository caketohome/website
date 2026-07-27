import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

/**
 * GET /store/cms/homepage
 * Returns the active homepage sections + active banners for the storefront.
 * Query: ?lang=en
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        getHomepageSections: (lang: string) => Promise<unknown[]>;
        getActiveBanners: (lang: string) => Promise<unknown[]>;
    };
    const lang = (req.query.lang as string) || "en";

    const [sections, banners] = await Promise.all([
        cmsModule.getHomepageSections(lang),
        cmsModule.getActiveBanners(lang),
    ]);

    return res.status(200).json({ sections, banners });
}
