import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { NOTIFICATION_MODULE } from "../../../../modules/notification";

/**
 * POST /admin/notifications/send
 * Send a raw notification (admin test / campaign).
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve<any>(NOTIFICATION_MODULE);

    const body = req.body as {
        channel: "sms" | "whatsapp" | "email" | "push";
        recipient: string;
        subject?: string;
        body: string;
        variables?: Record<string, unknown>;
    };

    if (!body.channel || !body.recipient || !body.body) {
        return res
            .status(400)
            .json({ message: "channel, recipient, body are required" });
    }

    const result = await notificationModule.send({
        channel: body.channel,
        recipient: body.recipient,
        subject: body.subject,
        body: body.body,
        variables: body.variables,
    });

    return res.status(result.success ? 200 : 422).json({ result });
}
