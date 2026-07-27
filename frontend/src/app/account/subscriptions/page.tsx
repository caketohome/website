import { SubscriptionsManager } from "@frontend/components/store/account/subscriptions-manager";
import { Heading } from "@medusajs/ui";

export default async function AccountSubscriptionsPage() {
  const items: any[] = [];
  return (
    <div className="flex flex-col gap-4">
      <Heading level="h2">My Bakery Subscriptions</Heading>
      <SubscriptionsManager initialSubscriptions={items} />
    </div>
  );
}
