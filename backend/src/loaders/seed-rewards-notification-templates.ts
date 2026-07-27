import { MedusaContainer } from "@medusajs/framework";
import { NOTIFICATION_MODULE } from "../modules/notification";

/**
 * Automatically seeds default notifications templates for rewards events if they do not exist.
 */
export default async function seedRewardsNotificationTemplates(container: MedusaContainer): Promise<void> {
  const logger = container.resolve("logger") as any;
  
  try {
    const notificationModule = container.resolve(NOTIFICATION_MODULE) as any;

    const templates = [
      {
        event: "wallet_credit",
        channel: "sms",
        name: "Wallet Credit Alert (SMS)",
        subject: "Wallet Credit Notification",
        body: "₹{{amount}} store credit has been added to your wallet. New balance: ₹{{balance}} (Notes: {{description}})",
      },
      {
        event: "wallet_credit",
        channel: "whatsapp",
        name: "Wallet Credit Alert (WhatsApp)",
        subject: "Wallet Credit Notification",
        body: "₹{{amount}} store credit has been added to your wallet. New balance: ₹{{balance}} (Notes: {{description}})",
      },
      {
        event: "wallet_debit",
        channel: "sms",
        name: "Wallet Debit Alert (SMS)",
        subject: "Wallet Debit Notification",
        body: "₹{{amount}} store credit has been debited from your wallet. New balance: ₹{{balance}} (Notes: {{description}})",
      },
      {
        event: "wallet_debit",
        channel: "whatsapp",
        name: "Wallet Debit Alert (WhatsApp)",
        subject: "Wallet Debit Notification",
        body: "₹{{amount}} store credit has been debited from your wallet. New balance: ₹{{balance}} (Notes: {{description}})",
      },
      {
        event: "gift_card_created",
        channel: "sms",
        name: "Gift Card Issued Alert (SMS)",
        subject: "Gift Voucher Created",
        body: "Your gift card voucher {{code}} has been generated with balance: ₹{{balance}}. Expiry: {{expiry}}",
      },
      {
        event: "gift_card_redeemed",
        channel: "sms",
        name: "Gift Card Redeemed Alert (SMS)",
        subject: "Gift Voucher Redemption",
        body: "Your gift card voucher {{code}} was redeemed for ₹{{amount}}. Remaining balance: ₹{{balance}}",
      },
      {
        event: "referral_reward_earned",
        channel: "sms",
        name: "Referral Reward Alert (SMS)",
        subject: "Referral Reward Claimed",
        body: "Congratulations! You have earned a referral reward of type {{reward_type}} valued at {{reward_value}}.",
      },
      {
        event: "referral_reward_earned",
        channel: "whatsapp",
        name: "Referral Reward Alert (WhatsApp)",
        subject: "Referral Reward Claimed",
        body: "Congratulations! You have earned a referral reward of type {{reward_type}} valued at {{reward_value}}.",
      },
    ];

    for (const t of templates) {
      const [existing] = await notificationModule.listNotificationTemplates({
        event: t.event,
        channel: t.channel,
      });

      if (!existing) {
        await notificationModule.createNotificationTemplates({
          event: t.event,
          channel: t.channel,
          name: t.name,
          subject: t.subject,
          body: t.body,
          is_active: true,
        });
        logger.info(`  ✓ Seeded rewards notification template: ${t.event} (${t.channel})`);
      }
    }
  } catch (err: any) {
    logger.error(`Failed to seed rewards notification templates: ${err.message}`);
  }
}
