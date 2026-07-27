import NotificationModuleService from "../service";
import { NotificationChannel } from "./provider";

export interface NotificationTemplateDTO {
    id: string;
    name: string;
    channel: NotificationChannel;
    event: string;
    subject: string | null;
    body: string;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface NotificationLogDTO {
    id: string;
    channel: NotificationChannel;
    recipient: string;
    template_id: string | null;
    event: string | null;
    status: string;
    provider: string | null;
    error: string | null;
    payload: string | null;
    created_at: Date;
    updated_at: Date;
}

export interface CreateNotificationTemplateDTO {
    name: string;
    channel: NotificationChannel;
    event: string;
    subject?: string;
    body: string;
    is_active?: boolean;
}

declare module "@medusajs/types" {
    export interface ModuleImplementations {
        notificationModuleService: NotificationModuleService;
    }
}
