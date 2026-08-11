import { DeliveryDTO, DeliveryStatus, DeliveryPartnerDTO } from "@frontend/lib/types";
import { Container, Heading, Text } from "@medusajs/ui";
import DeliveryCard from "./delivery-card";

export default async function DeliveryColumn({
  title,
  deliveries,
  statusFilters,
  delivery_partner,
  type,
}: {
  title: string;
  deliveries: DeliveryDTO[];
  statusFilters?: DeliveryStatus[];
  delivery_partner?: DeliveryPartnerDTO;
  type: "shop" | "delivery_partner";
}) {
  const columnDeliveries = deliveries?.filter(
    (d) => d && statusFilters?.includes(d.delivery_status)
  );

  return (
    <div className="inline-block w-full">
      <div className="flex flex-col gap-4 w-full">
        <Heading className="text-lg text-center">{title}</Heading>
        {columnDeliveries?.length > 0 ? (
          columnDeliveries.map((delivery) => (
            <DeliveryCard
              delivery={delivery}
              type={type}
              delivery_partner={delivery_partner}
              key={delivery.id}
            />
          ))
        ) : (
          <Container className="p-4 text-center bg-ui-bg-subtle/50 border border-dashed border-ui-border-base rounded-xl">
            <Text className="text-xs text-ui-fg-muted italic">No active {title.toLowerCase()} in your assigned kitchen hubs.</Text>
          </Container>
        )}
      </div>
    </div>
  );
}
