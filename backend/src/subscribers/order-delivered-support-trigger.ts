import { MedusaContainer } from "@medusajs/framework";

type OrderEventData = {
  id: string;
  customer_id?: string;
};

/**
 * Subscriber: order-delivered-support-trigger.
 *
 * Listens for "order.completed" events and dispatches post-delivery support
 * notifications greeting the customer.
 */
export default async function orderDeliveredSupportHandler({
  event,
  container,
}: {
  event: { data: OrderEventData; name: string };
  container: MedusaContainer;
}) {
  const notificationService = container.resolve("notificationModuleService") as any;
  const orderModule = container.resolve("orderModuleService") || container.resolve("order") as any;

  let customerId = event.data?.customer_id;
  if (!customerId && event.data?.id) {
    const order = await orderModule.retrieveOrder(event.data.id, { select: ["customer_id", "email"] }).catch(() => null);
    if (order) {
      customerId = order.customer_id;
    }
  }

  // Dispatch post-delivery welcome notification
  if (notificationService && event.data?.id) {
    await notificationService.send({
      channel: "email",
      recipient: "customer@email.com",
      subject: "Your CakeToHome Order is Delivered!",
      body: `Your cake order is successfully delivered. We hope you enjoy your purchase!`,
    }).catch(() => null);
  }
}

export const config = {
  event: ["order.completed"],
};
