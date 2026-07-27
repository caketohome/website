import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

/**
 * GET /store/cms/pages/:slug
 * Returns a published page by slug (+ optional lang).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        getPublishedPage: (slug: string, lang: string) => Promise<unknown>;
    };
    const slug = req.params.slug as string;
    const lang = (req.query.lang as string) || "en";

    const page = await cmsModule.getPublishedPage(slug, lang);

    if (!page) {
        return res.status(404).json({ message: "Page not found." });
    }

    return res.status(200).json({ page });
}
