import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { NOTIFICATION_MODULE } from "../../../../modules/notification";

/**
 * GET /admin/notifications/templates
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;
    const filters: Record<string, unknown> = {};
    if (req.query.channel) filters.channel = req.query.channel;
    if (req.query.event) filters.event = req.query.event;

    const templates = await notificationModule.listNotificationTemplates(filters);
    return res.status(200).json({ templates });
}

/**
 * POST /admin/notifications/templates
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;

    const body = req.body as {
        name: string;
        channel: "sms" | "whatsapp" | "email" | "push";
        event: string;
        subject?: string;
        body: string;
        is_active?: boolean;
    };

    if (!body.name || !body.channel || !body.event || !body.body) {
        return res.status(400).json({ message: "name, channel, event, body are required" });
    }

    const template = await notificationModule.createNotificationTemplates({
        name: body.name,
        channel: body.channel,
        event: body.event,
        subject: body.subject ?? null,
        body: body.body,
        is_active: body.is_active ?? true,
    });

    return res.status(200).json({ template });
}
