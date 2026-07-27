import type {
    NotificationProvider,
    NotificationSendInput,
    NotificationSendResult,
} from "../types/provider";

/**
 * Stub email provider. Logs the message and returns success.
 * Wire a real provider (e.g. SendGrid, SES, Postmark, Nodemailer SMTP) in production.
 */
export class EmailProvider implements NotificationProvider {
    readonly channel = "email" as const;
    readonly identifier = "email-stub";

    async send(
        input: NotificationSendInput
    ): Promise<NotificationSendResult> {
        console.info(
            `[CakeToHome Email] To: ${input.recipient} | Subject: ${input.subject ?? "(no subject)"} | Body length: ${input.body.length}`
        );
        return { success: true, providerMessageId: `email_${Date.now()}` };
    }
}
