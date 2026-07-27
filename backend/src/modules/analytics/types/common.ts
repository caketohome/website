import AnalyticsModuleService from "../service";

export interface AnalyticsEventDTO {
    id: string;
    event_type: string;
    entity_id: string | null;
    customer_id: string | null;
    session_id: string | null;
    branch_id: string | null;
    payload: Record<string, unknown> | null;
    created_at: Date;
}

export interface CreateAnalyticsEventDTO {
    event_type: string;
    entity_id?: string;
    customer_id?: string;
    session_id?: string;
    branch_id?: string;
    payload?: Record<string, unknown>;
}

export interface MetricResult {
    metric: string;
    value: number;
    period: string;
    branch_id?: string;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        analyticsModuleService: AnalyticsModuleService;
    }
}
