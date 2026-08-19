import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { LOCALIZATION_MODULE } from "../../../modules/localization";

/**
 * GET /store/localization
 * Public endpoint returning enabled languages, currencies, and translations
 * for the requested language (?language_code=xx).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const locModule = req.scope.resolve(LOCALIZATION_MODULE) as any;

    const languages = await locModule.getEnabledLanguages();
    const currencies = await locModule.getEnabledCurrencies();

    const languageCode = req.query.language_code as string | undefined;
    let translations: Record<string, Record<string, string>> = {};

    if (languageCode) {
        translations = await locModule.getTranslations(languageCode);
    }

    return res.status(200).json({ languages, currencies, translations });
}
