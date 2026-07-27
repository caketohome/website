import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

/**
 * GET /store/cms/blog
 * Returns published blog posts.
 * Query: ?lang=en&category_id=xxx&limit=20&offset=0
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        listPublishedBlogPosts: (opts: {
            languageCode?: string;
            categoryId?: string;
            limit?: number;
            offset?: number;
        }) => Promise<unknown[]>;
    };

    const posts = await cmsModule.listPublishedBlogPosts({
        languageCode: (req.query.lang as string) || "en",
        categoryId: req.query.category_id as string | undefined,
        limit: req.query.limit ? Number(req.query.limit) : 20,
        offset: req.query.offset ? Number(req.query.offset) : 0,
    });

    return res.status(200).json({ posts });
}
