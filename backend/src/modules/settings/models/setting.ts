import { model } from "@medusajs/utils";

/**
 * Centralized setting entry. Each row is a typed key within a setting group.
 * Groups: system, business, delivery, payment, seo, referral, loyalty,
 * wallet, notification, marketing, feature_flags, localization, ai, platform.
 */
export const Setting = model.define("setting", {
    id: model
        .id({
            prefix: "set",
        })
        .primaryKey(),
    group: model.text(),
    key: model.text(),
    value: model.text().nullable(),
    is_json: model.boolean().default(false),
    is_secret: model.boolean().default(false),
    description: model.text().nullable(),
});

export const SettingGroup = [
    "system",
    "business",
    "delivery",
    "payment",
    "seo",
    "referral",
    "loyalty",
    "wallet",
    "notification",
    "marketing",
    "feature_flags",
    "localization",
    "ai",
    "platform",
] as const;

export type SettingGroupName = (typeof SettingGroup)[number];
