import WebhookModuleService from "../service";

export interface WebhookEndpointDTO {
    id: string;
    url: string;
    events: string[];
    secret: string | null;
    is_active: boolean;
    description: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface WebhookDeliveryDTO {
    id: string;
    webhook_id: string;
    event: string;
    payload: Record<string, unknown> | null;
    status: string;
    response_code: number | null;
    error: string | null;
    attempts: number;
    created_at: Date;
}

export interface CreateWebhookEndpointDTO {
    url: string;
    events: string[];
    secret?: string;
    is_active?: boolean;
    description?: string;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        webhookModuleService: WebhookModuleService;
    }
}
