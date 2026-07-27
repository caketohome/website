import { MedusaService } from "@medusajs/utils";
import { WebhookEndpoint, WebhookDelivery } from "./models";
import { createHmac } from "crypto";

/**
 * Webhook Engine module service.
 * Publishes platform events to admin-configured endpoints with signed payloads.
 */
class WebhookModuleService extends MedusaService({
    WebhookEndpoint,
    WebhookDelivery,
}) {
    /**
     * Publish an event to all subscribed endpoints.
     * Delivers via fetch with HMAC signature and logs each attempt.
     */
    async publish(event: string, payload: Record<string, unknown>): Promise<void> {
        const endpoints = await this.listWebhookEndpoints({ is_active: true });

        for (const endpoint of endpoints) {
            const ep = endpoint as Record<string, unknown>;
            const eventsStr = ep.events as string;
            const subscribedEvents = eventsStr ? JSON.parse(eventsStr) as string[] : [];
            if (!subscribedEvents.includes(event) && !subscribedEvents.includes("*")) {
                continue;
            }

            await this.deliver(
                ep.id as string,
                ep.url as string,
                ep.secret as string | null,
                event,
                payload
            );
        }
    }

    private async deliver(
        webhookId: string,
        url: string,
        secret: string | null,
        event: string,
        payload: Record<string, unknown>
    ): Promise<void> {
        const body = JSON.stringify({ event, payload, sent_at: new Date().toISOString() });
        const signature = secret
            ? createHmac("sha256", secret).update(body).digest("hex")
            : null;

        let status = "pending";
        let responseCode: number | null = null;
        let error: string | null = null;

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-CakeToHome-Event": event,
                    ...(signature ? { "X-CakeToHome-Signature": signature } : {}),
                },
                body,
                signal: AbortSignal.timeout(10000),
            });

            responseCode = response.status;
            status = response.ok ? "delivered" : "failed";

            if (!response.ok) {
                error = `HTTP ${response.status}`;
            }
        } catch (err) {
            status = "failed";
            error = err instanceof Error ? err.message : String(err);
        }

        await this.createWebhookDeliveries({
            webhook_id: webhookId,
            event,
            payload: body,
            status,
            response_code: responseCode,
            error,
            attempts: 1,
        });
    }
}

export default WebhookModuleService;
