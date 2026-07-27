import SettingsModuleService from "../service";

export interface SettingDTO {
    id: string;
    group: string;
    key: string;
    value: string | null;
    is_json: boolean;
    is_secret: boolean;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface UpsertSettingDTO {
    group: string;
    key: string;
    value: unknown;
    is_json?: boolean;
    is_secret?: boolean;
    description?: string;
}

export interface SettingGroupDTO {
    group: string;
    settings: Record<string, unknown>;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        settingsModuleService: SettingsModuleService;
    }
}
