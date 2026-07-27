import type {
    NotificationProvider,
    NotificationSendInput,
    NotificationSendResult,
} from "../types/provider";

/**
 * Stub SMS provider. Logs the message and returns success.
 * Replace credentials via Settings (notification group) and wire a real
 * provider (e.g. Twilio, MSG91, Kaleyra) in production.
 */
export class SmsProvider implements NotificationProvider {
    readonly channel = "sms" as const;
    readonly identifier = "sms-stub";

    async send(
        input: NotificationSendInput
    ): Promise<NotificationSendResult> {
        console.info(
            `[CakeToHome SMS] To: ${input.recipient} | Body: ${input.body}`
        );
        return { success: true, providerMessageId: `sms_${Date.now()}` };
    }
}
