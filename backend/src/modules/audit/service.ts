import { MedusaService } from "@medusajs/utils";
import { AuditLog, ConfigAuditLog } from "./models";
import type { CreateAuditLogDTO } from "./types/common";

/**
 * Audit Engine module service.
 * Centralized activity logging across all platform modules.
 */
class AuditModuleService extends MedusaService({
    AuditLog,
    ConfigAuditLog,
}) {
    /**
     * Record an audit log entry.
     */
    async log(input: CreateAuditLogDTO): Promise<void> {
        await this.createAuditLogs({
            actor_id: input.actor_id ?? null,
            actor_type: input.actor_type ?? null,
            action: input.action,
            entity: input.entity ?? null,
            entity_id: input.entity_id ?? null,
            ip_address: input.ip_address ?? null,
            user_agent: input.user_agent ?? null,
            metadata: input.metadata ? JSON.stringify(input.metadata) : null,
        });
    }

    /**
     * List audit logs filtered by actor, entity, or action.
     */
    async query(filters: {
        actor_id?: string;
        entity?: string;
        entity_id?: string;
        action?: string;
    }) {
        return this.listAuditLogs(filters);
    }
}

export default AuditModuleService;
