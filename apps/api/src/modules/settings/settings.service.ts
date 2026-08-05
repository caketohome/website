import { SettingsRepository } from "./settings.repository";
import { DEFAULT_FEATURE_FLAGS, SETTING_GROUPS } from "./settings.constants";
import { FeatureFlagsMap, SettingInput } from "./settings.types";

export class SettingsService {
  private repository: SettingsRepository;

  constructor(repository: SettingsRepository = new SettingsRepository()) {
    this.repository = repository;
  }

  async getValue<T = string>(group: string, key: string, defaultValue?: T): Promise<T | null> {
    const setting = await this.repository.getSetting(group, key);
    if (!setting) {
      return defaultValue ?? null;
    }

    if (setting.is_json && setting.value) {
      try {
        return JSON.parse(setting.value) as T;
      } catch {
        return defaultValue ?? null;
      }
    }

    return (setting.value as unknown as T) ?? defaultValue ?? null;
  }

  async getFeatureFlags(): Promise<FeatureFlagsMap> {
    const customFlags = await this.repository.listSettingsByGroup(SETTING_GROUPS.FEATURE_FLAGS);
    const flags: FeatureFlagsMap = { ...DEFAULT_FEATURE_FLAGS };

    for (const flag of customFlags) {
      try {
        flags[flag.key] = flag.value === "true" || flag.value === "1" || JSON.parse(flag.value) === true;
      } catch {
        flags[flag.key] = flag.value === "true";
      }
    }

    return flags;
  }

  async isFeatureEnabled(flagKey: string): Promise<boolean> {
    const flags = await this.getFeatureFlags();
    return Boolean(flags[flagKey]);
  }

  async setSetting(input: SettingInput) {
    return this.repository.upsertSetting({
      group: input.group,
      key: input.key,
      value: typeof input.value === "object" ? JSON.stringify(input.value) : String(input.value),
      is_json: typeof input.value === "object" || Boolean(input.is_json),
      is_secret: Boolean(input.is_secret),
      description: input.description,
    });
  }

  async getGroupSettings(group: string, includeSecrets = false): Promise<Record<string, any>> {
    const list = await this.repository.listSettingsByGroup(group);
    const result: Record<string, any> = {};

    for (const item of list) {
      if (item.is_secret && !includeSecrets) {
        continue;
      }

      if (item.is_json && item.value) {
        try {
          result[item.key] = JSON.parse(item.value);
        } catch {
          result[item.key] = item.value;
        }
      } else {
        result[item.key] = item.value;
      }
    }

    return result;
  }
}
