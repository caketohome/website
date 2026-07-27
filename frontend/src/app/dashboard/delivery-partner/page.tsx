import AccountBadge from "@frontend/components/dashboard/account-badge";
import DeliveryColumn from "@frontend/components/dashboard/delivery-column";
import RealtimeClient from "@frontend/components/dashboard/realtime-client";
import {
  listDeliveries,
  retrieveDeliveryPartner,
  retrieveUser,
} from "@frontend/lib/data";
import { DeliveryStatus } from "@frontend/lib/types";
import { Container, Heading, Text } from "@medusajs/ui";
import { redirect } from "next/navigation";

export default async function DeliveryPartnerDashboardPage() {
  const user = await retrieveUser();

  if (!user || (!user.id.includes("dlp_") && !user.id.includes("admin_"))) {
    redirect("/login");
  }

  const dlpId = user.id.includes("dlp_") ? user.id : "dlp_01";
  const delivery_partner = await retrieveDeliveryPartner(dlpId);
  const deliveries = await listDeliveries({
    delivery_partner_id: delivery_partner.id,
  });

  return (
    <div className="flex flex-col gap-20">
      <Container className="flex flex-col md:flex-row gap-4 justify-between p-8">
        <div className="flex flex-col justify-between">
          <Heading level="h1" className="text-2xl">
            {delivery_partner.first_name} {delivery_partner.last_name} | Delivery Partner Dashboard
          </Heading>
          <Text>View and manage your CakeToHome deliveries.</Text>
          <RealtimeClient delivery_partnerId={delivery_partner.id} />
        </div>
        <AccountBadge data={delivery_partner} type="delivery_partner" />
      </Container>
      <div className="overflow-x-auto whitespace-nowrap ">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-px">
          <DeliveryColumn
            title="Available jobs"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.SHOP_ACCEPTED]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Claimed jobs"
            deliveries={deliveries}
            statusFilters={[
              DeliveryStatus.PICKUP_CLAIMED,
              DeliveryStatus.SHOP_PREPARING,
            ]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Ready for pickup"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.READY_FOR_PICKUP]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="In transit"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.IN_TRANSIT]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
          <DeliveryColumn
            title="Completed"
            deliveries={deliveries}
            statusFilters={[DeliveryStatus.DELIVERED]}
            type="delivery_partner"
            delivery_partner={delivery_partner}
          />
        </div>
      </div>
    </div>
  );
}
