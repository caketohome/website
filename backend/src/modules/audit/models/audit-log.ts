import { model } from "@medusajs/utils";

/**
 * Centralized audit log entry. Records every significant action across all modules
 * for security, compliance, and debugging.
 */
export const AuditLog = model.define("audit_log", {
    id: model
        .id({
            prefix: "aud",
        })
        .primaryKey(),
    actor_id: model.text().nullable(),
    actor_type: model.text().nullable(),
    action: model.text(),
    entity: model.text().nullable(),
    entity_id: model.text().nullable(),
    ip_address: model.text().nullable(),
    user_agent: model.text().nullable(),
    metadata: model.text().nullable(),
});
