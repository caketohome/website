import LocalizationModuleService from "../service";

export interface LanguageDTO {
    id: string;
    code: string;
    name: string;
    is_default: boolean;
    is_enabled: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface CurrencyDTO {
    id: string;
    code: string;
    symbol: string;
    name: string;
    rate: number;
    is_default: boolean;
    is_enabled: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface TranslationDTO {
    id: string;
    language_code: string;
    key: string;
    value: string;
    namespace: string;
    created_at: Date;
    updated_at: Date;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        localizationModuleService: LocalizationModuleService;
    }
}
