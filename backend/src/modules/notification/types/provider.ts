/**
 * Notification provider abstraction.
 * Each channel (sms, whatsapp, email, push) implements this interface.
 * Providers are registered in the service and selected by channel.
 */

export type NotificationChannel = "sms" | "whatsapp" | "email" | "push";

export interface NotificationSendInput {
    channel: NotificationChannel;
    recipient: string;
    subject?: string;
    body: string;
    variables?: Record<string, unknown>;
    payload?: Record<string, unknown>;
}

export interface NotificationSendResult {
    success: boolean;
    providerMessageId?: string;
    error?: string;
}

export interface NotificationProvider {
    readonly channel: NotificationChannel;
    readonly identifier: string;
    send(input: NotificationSendInput): Promise<NotificationSendResult>;
}
