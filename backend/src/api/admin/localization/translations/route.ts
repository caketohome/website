import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { LOCALIZATION_MODULE } from "../../../../modules/localization";
import LocalizationModuleService from "../../../../modules/localization/service";

/**
 * GET /admin/localization/translations?language_code=xx
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve<LocalizationModuleService>(LOCALIZATION_MODULE);
    const languageCode = req.query.language_code as string;

    if (!languageCode) {
        return res
            .status(400)
            .json({ message: "language_code is required" });
    }

    const translations = await locModule.getTranslations(languageCode);
    return res.status(200).json({ language_code: languageCode, translations });
}

/**
 * POST /admin/localization/translations
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve<LocalizationModuleService>(LOCALIZATION_MODULE);

    const body = req.body as {
        language_code: string;
        key: string;
        value: string;
        namespace?: string;
    };

    if (!body.language_code || !body.key || !body.value) {
        return res
            .status(400)
            .json({ message: "language_code, key, value are required" });
    }

    const translation = await locModule.upsertTranslation(
        body.language_code,
        body.key,
        body.value,
        body.namespace
    );

    return res.status(200).json({ translation });
}
