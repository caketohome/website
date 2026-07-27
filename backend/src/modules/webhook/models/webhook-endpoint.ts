import { model } from "@medusajs/utils";

/**
 * Admin-configured outbound webhook endpoint.
 * Subscribes to platform events and delivers signed JSON payloads.
 */
export const WebhookEndpoint = model.define("webhook_endpoint", {
    id: model
        .id({
            prefix: "whk",
        })
        .primaryKey(),
    url: model.text(),
    events: model.text(),
    secret: model.text().nullable(),
    is_active: model.boolean().default(true),
    description: model.text().nullable(),
});

/**
 * Delivery attempt log for a webhook.
 */
export const WebhookDelivery = model.define("webhook_delivery", {
    id: model
        .id({
            prefix: "whkdel",
        })
        .primaryKey(),
    webhook_id: model.text(),
    event: model.text(),
    payload: model.text().nullable(),
    status: model.text().default("pending"),
    response_code: model.number().nullable(),
    error: model.text().nullable(),
    attempts: model.number().default(0),
});
