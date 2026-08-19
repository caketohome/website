import type {
    NotificationProvider,
    NotificationSendInput,
    NotificationSendResult,
} from "../types/provider";

/**
 * Stub push notification provider. Logs the message and returns success.
 * Wire Firebase Cloud Messaging in production.
 */
export class PushProvider implements NotificationProvider {
    readonly channel = "push" as const;
    readonly identifier = "push-stub";

    async send(
        input: NotificationSendInput
    ): Promise<NotificationSendResult> {
        console.info(
            `[CakeToHome Push] To: ${input.recipient} | Payload: ${input.body}`
        );
        return { success: true, providerMessageId: `push_${Date.now()}` };
    }
}
