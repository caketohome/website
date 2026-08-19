import type {
    NotificationProvider,
    NotificationSendInput,
    NotificationSendResult,
} from "../types/provider";

/**
 * Stub WhatsApp Business provider. Logs the message and returns success.
 * Wire the real WhatsApp Business API (Cloud API / BSP) in production.
 */
export class WhatsAppProvider implements NotificationProvider {
    readonly channel = "whatsapp" as const;
    readonly identifier = "whatsapp-stub";

    async send(
        input: NotificationSendInput
    ): Promise<NotificationSendResult> {
        console.info(
            `[CakeToHome WhatsApp] To: ${input.recipient} | Template body: ${input.body}`
        );
        return { success: true, providerMessageId: `wa_${Date.now()}` };
    }
}
