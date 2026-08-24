import { MedusaRequest, MedusaResponse } from "@medusajs/framework";
import { NOTIFICATION_MODULE } from "../../../../../modules/notification";

/**
 * GET /admin/notifications/templates/:id
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;
    const template = await notificationModule.retrieveNotificationTemplate(
        req.params.id
    );
    return res.status(200).json({ template });
}

/**
 * POST /admin/notifications/templates/:id
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;

    const body = req.body as {
        name?: string;
        subject?: string;
        body?: string;
        is_active?: boolean;
    };

    const template = await notificationModule.updateNotificationTemplates({
        selector: { id: req.params.id },
        data: body,
    });

    return res.status(200).json({ template });
}

/**
 * DELETE /admin/notifications/templates/:id
 */
export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
    const notificationModule = req.scope.resolve(NOTIFICATION_MODULE) as any;
    await notificationModule.deleteNotificationTemplates([req.params.id]);
    return res.status(200).json({ id: req.params.id, deleted: true });
}
