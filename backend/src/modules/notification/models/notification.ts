import { model } from "@medusajs/utils";

/**
 * Admin-editable notification template.
 * channel: sms | whatsapp | email | push
 * body for email is HTML; for sms/whatsapp plain text with {{vars}}; for push a JSON payload.
 */
export const NotificationTemplate = model.define("notification_template", {
    id: model
        .id({
            prefix: "nlt",
        })
        .primaryKey(),
    name: model.text(),
    channel: model.text(),
    event: model.text(),
    subject: model.text().nullable(),
    body: model.text(),
    is_active: model.boolean().default(true),
});

/**
 * Outbound notification log entry.
 */
export const NotificationLog = model.define("notification_log", {
    id: model
        .id({
            prefix: "nll",
        })
        .primaryKey(),
    channel: model.text(),
    recipient: model.text(),
    template_id: model.text().nullable(),
    event: model.text().nullable(),
    status: model.text().default("pending"),
    provider: model.text().nullable(),
    error: model.text().nullable(),
    payload: model.text().nullable(),
});
