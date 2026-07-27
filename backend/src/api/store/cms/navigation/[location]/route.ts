import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { CMS_MODULE } from "../../../../../modules/cms";

/**
 * GET /store/cms/navigation/:location
 * Returns the active navigation tree for a location (header, footer, mega_menu, sidebar, mobile).
 * Query: ?lang=en
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const cmsModule = req.scope.resolve(CMS_MODULE) as {
        getNavigation: (location: string, lang: string) => Promise<unknown>;
    };
    const location = req.params.location as string;
    const lang = (req.query.lang as string) || "en";

    const navigation = await cmsModule.getNavigation(location, lang);

    if (!navigation) {
        return res.status(404).json({ message: "Navigation not found." });
    }

    return res.status(200).json({ navigation });
}
