import { MedusaService } from "@medusajs/utils";
import { Language, Currency, Translation } from "./models";

/**
 * Localization module service.
 * Manages languages, currencies, and translations for multi-language/multi-currency support.
 */
class LocalizationModuleService extends MedusaService({
    Language,
    Currency,
    Translation,
}) {
    /**
     * Get the default language.
     */
    async getDefaultLanguage() {
        const [language] = await this.listLanguages({ is_default: true });
        return language ?? null;
    }

    /**
     * Get the default currency.
     */
    async getDefaultCurrency() {
        const [currency] = await this.listCurrencies({ is_default: true });
        return currency ?? null;
    }

    /**
     * Get all enabled languages.
     */
    async getEnabledLanguages() {
        return this.listLanguages({ is_enabled: true });
    }

    /**
     * Get all enabled currencies.
     */
    async getEnabledCurrencies() {
        return this.listCurrencies({ is_enabled: true });
    }

    /**
     * Get all translations for a language, grouped by namespace.
     */
    async getTranslations(languageCode: string) {
        const translations = await this.listTranslations({
            language_code: languageCode,
        });
        const result: Record<string, Record<string, string>> = {};

        for (const t of translations) {
            const ns = (t as Record<string, unknown>).namespace as string;
            const key = (t as Record<string, unknown>).key as string;
            const value = (t as Record<string, unknown>).value as string;
            if (!result[ns]) result[ns] = {};
            result[ns][key] = value;
        }

        return result;
    }

    /**
     * Upsert a single translation.
     */
    async upsertTranslation(
        languageCode: string,
        key: string,
        value: string,
        namespace = "common"
    ) {
        const [existing] = await this.listTranslations({
            language_code: languageCode,
            key,
            namespace,
        });

        if (existing) {
            return this.updateTranslations({
                selector: { id: (existing as Record<string, unknown>).id as string },
                data: { value },
            });
        }

        return this.createTranslations({
            language_code: languageCode,
            key,
            value,
            namespace,
        });
    }

    /**
     * Convert an amount from the default currency to a target currency.
     */
    async convertCurrency(amount: number, targetCode: string) {
        const [target] = await this.listCurrencies({ code: targetCode });
        if (!target) return amount;
        const rate = (target as Record<string, unknown>).rate as number;
        return Number((amount * rate).toFixed(2));
    }
}

export default LocalizationModuleService;
