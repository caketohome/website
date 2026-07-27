import AuditModuleService from "../service";

export interface AuditLogDTO {
    id: string;
    actor_id: string | null;
    actor_type: string | null;
    action: string;
    entity: string | null;
    entity_id: string | null;
    ip_address: string | null;
    user_agent: string | null;
    metadata: Record<string, unknown> | null;
    created_at: Date;
}

export interface CreateAuditLogDTO {
    actor_id?: string;
    actor_type?: string;
    action: string;
    entity?: string;
    entity_id?: string;
    ip_address?: string;
    user_agent?: string;
    metadata?: Record<string, unknown>;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        auditModuleService: AuditModuleService;
    }
}
