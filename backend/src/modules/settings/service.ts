import { MedusaService } from "@medusajs/utils";
import { Setting } from "./models";

/**
 * Settings module service - centralized, DB-backed, admin-editable configuration.
 * Provides typed access to setting groups and a feature-flag helper.
 */
class SettingsModuleService extends MedusaService({
    Setting,
}) {
    /**
     * Retrieve a single setting value by group + key.
     * Returns the raw string value, or parsed JSON when is_json is true.
     */
    async getValue<T = string>(group: string, key: string): Promise<T | null> {
        const [setting] = await this.listSettings({
            group,
            key,
        });

        if (!setting) {
            return null;
        }

        if (setting.is_json && setting.value) {
            try {
                return JSON.parse(setting.value) as T;
            } catch {
                return null;
            }
        }

        return (setting.value as unknown as T) ?? null;
    }

    /**
     * Retrieve all settings within a group as a key/value map.
     * JSON values are parsed; secret values are excluded unless includeSecrets is true.
     */
    async getGroup(
        group: string,
        includeSecrets = false
    ): Promise<Record<string, unknown>> {
        const settings = await this.listSettings({ group });
        const result: Record<string, unknown> = {};

        for (const setting of settings) {
            if (setting.is_secret && !includeSecrets) {
                continue;
            }

            if (setting.is_json && setting.value) {
                try {
                    result[setting.key] = JSON.parse(setting.value);
                } catch {
                    result[setting.key] = setting.value;
                }
            } else {
                result[setting.key] = setting.value;
            }
        }

        return result;
    }

    /**
     * Upsert a setting value. When value is an object/array, it is JSON-stringified.
     */
    async upsertValue(
        group: string,
        key: string,
        value: unknown,
        options?: { is_json?: boolean; is_secret?: boolean; description?: string }
    ): Promise<void> {
        const isJson = options?.is_json ?? typeof value === "object";
        const storedValue =
            value === null || value === undefined
                ? null
                : isJson
                    ? JSON.stringify(value)
                    : String(value);

        const [existing] = await this.listSettings({ group, key });

        if (existing) {
            await this.updateSettings({
                selector: { id: existing.id },
                data: {
                    value: storedValue,
                    is_json: isJson,
                    is_secret: options?.is_secret ?? existing.is_secret,
                    description: options?.description ?? existing.description,
                },
            });
            return;
        }

        await this.createSettings({
            group,
            key,
            value: storedValue,
            is_json: isJson,
            is_secret: options?.is_secret ?? false,
            description: options?.description ?? null,
        });
    }

    /**
     * Feature-flag helper. Reads from the "feature_flags" group.
     * Returns the boolean enabled state, defaulting to false when missing.
     */
    async isFeatureEnabled(key: string): Promise<boolean> {
        const value = await this.getValue<unknown>("feature_flags", key);
        return value === true || value === "true";
    }
}

export default SettingsModuleService;
