export interface SettingItem {
  id?: string;
  group: string;
  key: string;
  value: string;
  is_json?: boolean;
  is_secret?: boolean;
  description?: string;
}

export interface SettingInput {
  group: string;
  key: string;
  value: any;
  is_json?: boolean;
  is_secret?: boolean;
  description?: string;
}

export interface FeatureFlagsMap {
  [flagKey: string]: boolean;
}
