import { Logger } from "@medusajs/medusa";
import { ContainerRegistrationKeys } from "@medusajs/utils";
import { ExecArgs } from "@medusajs/types";
import dotenv from "dotenv";
import { SETTINGS_MODULE } from "../modules/settings";

dotenv.config();

/**
 * Seeds the Phase 9.2 `marketing_manager` permission/role into the Settings
 * module (group: `permissions`). Idempotent — upserts the role definition.
 * Run with: `npx medusa exec ./src/scripts/seed-permissions.ts`
 *
 * The permission is enforced at the admin API layer via Medusa admin auth +
 * the role membership stored here. Admin routes under /admin/marketing/** and
 * /admin/offers/** require the caller to have the `marketing_manager` role
 * (or be a super admin).
 */
export default async function seedPermissions({ container }: ExecArgs) {
    const logger: Logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const settingsModule = container.resolve(SETTINGS_MODULE) as {
        upsertValue: (
            group: string,
            key: string,
            value: unknown,
            options?: { is_json?: boolean; description?: string }
        ) => Promise<void>;
    };

    const permissions: Array<{
        key: string;
        value: Record<string, unknown>;
        description: string;
    }> = [
            {
                key: "marketing_manager",
                value: {
                    label: "Marketing Manager",
                    description:
                        "Manages marketing campaigns, offers/coupons, popups, gamification, QR codes, newsletter, and recovery jobs.",
                    scopes: [
                        "admin/marketing/**",
                        "admin/offers/**",
                    ],
                    inherits: [],
                },
                description: "Phase 9.2 — Marketing Manager role",
            },
        ];

    logger.info("Seeding permissions...");

    for (const perm of permissions) {
        await settingsModule.upsertValue(
            "permissions",
            perm.key,
            perm.value,
            { is_json: true, description: perm.description }
        );
        logger.info(`  ✓ ${perm.key}`);
    }

    logger.info("Permissions seeded successfully.");
}
