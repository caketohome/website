import { DeliveryDTO, DeliveryStatus, DeliveryPartnerDTO } from "@frontend/lib/types";
import { Heading } from "@medusajs/ui";
import DeliveryCard from "./delivery-card";

export default async function CompletedGrid({
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
  return (
    <div className="flex gap-4">
      <Heading className="text-lg text-center">{title}</Heading>
      {deliveries
        .filter((d) => statusFilters?.includes(d.delivery_status))
        .sort(
          (a, b) =>
            new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
        .map((delivery) => (
          <DeliveryCard
            delivery={delivery}
            type={type}
            delivery_partner={delivery_partner}
            key={delivery.id}
          />
        ))}
    </div>
  );
}
