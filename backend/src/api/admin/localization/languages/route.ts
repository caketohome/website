import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { LOCALIZATION_MODULE } from "../../../../modules/localization";
import LocalizationModuleService from "../../../../modules/localization/service";

/**
 * GET /admin/localization/languages
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve<LocalizationModuleService>(LOCALIZATION_MODULE);
    const languages = await locModule.listLanguages({});
    return res.status(200).json({ languages });
}

/**
 * POST /admin/localization/languages
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve<LocalizationModuleService>(LOCALIZATION_MODULE);

    const body = req.body as {
        code: string;
        name: string;
        is_default?: boolean;
        is_enabled?: boolean;
    };

    if (!body.code || !body.name) {
        return res.status(400).json({ message: "code and name are required" });
    }

    const language = await locModule.createLanguages({
        code: body.code,
        name: body.name,
        is_default: body.is_default ?? false,
        is_enabled: body.is_enabled ?? true,
    });

    return res.status(200).json({ language });
}
