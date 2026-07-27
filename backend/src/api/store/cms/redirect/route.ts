import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../modules/cms";

/**
 * GET /store/cms/redirect?from=/old-path
 * Resolves a redirect for the given path. Returns 404 if none.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        resolveRedirect: (from: string) => Promise<{ to_url: string; redirect_type: number } | null>;
    };
    const from = req.query.from as string;

    if (!from) {
        return res.status(400).json({ message: "Missing 'from' query parameter." });
    }

    const redirect = await cmsModule.resolveRedirect(from);

    if (!redirect) {
        return res.status(404).json({ message: "No redirect found." });
    }

    return res.status(200).json({ redirect });
}
