import { MedusaService } from "@medusajs/utils";
import { NotificationTemplate, NotificationLog } from "./models";
import { SmsProvider } from "./providers/sms";
import { WhatsAppProvider } from "./providers/whatsapp";
import { EmailProvider } from "./providers/email";
import { PushProvider } from "./providers/push";
import type {
    NotificationChannel,
    NotificationProvider,
    NotificationSendInput,
    NotificationSendResult,
} from "./types/provider";

/**
 * Notification module service.
 * Provides a unified `send` API that resolves the provider for a channel,
 * renders templates with variables, and logs every outbound notification.
 */
class NotificationModuleService extends MedusaService({
    NotificationTemplate,
    NotificationLog,
}) {
    private providers: Map<NotificationChannel, NotificationProvider> = new Map();

    constructor(...args: unknown[]) {
        super(...(args as never[]));
        this.registerProvider(new SmsProvider());
        this.registerProvider(new WhatsAppProvider());
        this.registerProvider(new EmailProvider());
        this.registerProvider(new PushProvider());
    }

    registerProvider(provider: NotificationProvider): void {
        this.providers.set(provider.channel, provider);
    }

    /**
     * Replace {{var}} placeholders in a template string.
     */
    private renderTemplate(
        template: string,
        variables: Record<string, unknown> = {}
    ): string {
        return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
            const value = variables[key];
            return value === undefined || value === null ? "" : String(value);
        });
    }

    /**
     * Resolve a template by event + channel, render it, and send.
     */
    async sendByEvent(
        event: string,
        channel: NotificationChannel,
        recipient: string,
        variables: Record<string, unknown> = {}
    ): Promise<NotificationSendResult> {
        const [template] = await this.listNotificationTemplates({
            event,
            channel,
            is_active: true,
        });

        if (!template) {
            return {
                success: false,
                error: `No active template for event "${event}" on channel "${channel}"`,
            };
        }

        const body = this.renderTemplate(template.body, variables);
        const subject = template.subject
            ? this.renderTemplate(template.subject, variables)
            : undefined;

        return this.send({
            channel,
            recipient,
            subject,
            body,
            variables,
        });
    }

    /**
     * Send a raw notification via the registered provider for the channel.
     * Always logs the outcome.
     */
    async send(
        input: NotificationSendInput
    ): Promise<NotificationSendResult> {
        const provider = this.providers.get(input.channel);

        if (!provider) {
            await this.createNotificationLogs({
                channel: input.channel,
                recipient: input.recipient,
                event: null,
                status: "failed",
                provider: null,
                error: `No provider registered for channel "${input.channel}"`,
                payload: input.payload ? JSON.stringify(input.payload) : null,
            });
            return { success: false, error: "No provider registered" };
        }

        try {
            const result = await provider.send(input);

            await this.createNotificationLogs({
                channel: input.channel,
                recipient: input.recipient,
                event: null,
                status: result.success ? "sent" : "failed",
                provider: provider.identifier,
                error: result.error ?? null,
                payload: input.payload ? JSON.stringify(input.payload) : null,
            });

            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);

            await this.createNotificationLogs({
                channel: input.channel,
                recipient: input.recipient,
                event: null,
                status: "failed",
                provider: provider.identifier,
                error: message,
                payload: input.payload ? JSON.stringify(input.payload) : null,
            });

            return { success: false, error: message };
        }
    }
}

export default NotificationModuleService;
