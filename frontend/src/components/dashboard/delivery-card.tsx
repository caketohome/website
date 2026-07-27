import { DeliveryDTO, DeliveryPartnerDTO } from "@frontend/lib/types";
import { Container, Heading, Table } from "@medusajs/ui";
import DeliveryPartnerDeliveryButtons from "./delivery-partner/delivery-buttons";
import { DeliveryPartnerDeliveryStatusBadge } from "./delivery-partner/delivery-status-badge";
import ShopDeliveryButtons from "./shop/delivery-buttons";
import { ShopDeliveryStatusBadge } from "./shop/delivery-status-badge";

export default async function DeliveryCard({
  delivery,
  delivery_partner,
  type,
}: {
  delivery: DeliveryDTO;
  delivery_partner?: DeliveryPartnerDTO;
  type: "shop" | "delivery_partner";
}) {
  if (!delivery || delivery === null) return null;

  const items = delivery.order?.items || delivery.cart?.items;

  return (
    <Container className="flex flex-col gap-6 p-4 shadow-elevation-card-rest hover:shadow-elevation-card-hover w-full">
      <div className="flex justify-between gap-2 flex-wrap">
        <Heading className="text-large font-bold">
          Order {delivery?.id?.slice(-4)}
        </Heading>
        {type === "delivery_partner" && <DeliveryPartnerDeliveryStatusBadge delivery={delivery} />}
        {type === "shop" && (
          <ShopDeliveryStatusBadge delivery={delivery} />
        )}
      </div>
      {/* Recipient Details & Delivery Notes */}
      <div className="flex flex-col gap-1 bg-ui-bg-subtle p-3 rounded-lg border text-xs">
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          👤 Recipient: {delivery.recipient_name || delivery.order?.shipping_address?.first_name || "Customer"}
        </span>
        <span>📞 Phone: {delivery.recipient_phone || delivery.order?.shipping_address?.phone || "+91 98765 43210"}</span>
        <span>📍 Address: {delivery.recipient_address || delivery.order?.shipping_address?.address_1 || "Delivery Location"} ({delivery.recipient_pincode || delivery.order?.shipping_address?.postal_code || "560001"})</span>
        {delivery.recipient_landmark && <span>🏠 Landmark: {delivery.recipient_landmark}</span>}
        {delivery.delivery_instructions && <span className="italic text-ui-fg-muted">💬 Note: &quot;{delivery.delivery_instructions}&quot;</span>}
        {delivery.gift_message && <span className="font-medium text-purple-600 dark:text-purple-400">🎁 Gift Card Message Included</span>}
        {delivery.delivery_otp && (
          <span className="mt-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded w-fit">
            🔑 Delivery Verification OTP Required
          </span>
        )}
      </div>

      <div className="flex gap-4 overflow-auto max-w-full">
        <Table className="overflow-auto w-full">
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Items</Table.HeaderCell>
              <Table.HeaderCell className="text-right max-w-8">Qty</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {items?.map((item) => (
              <Table.Row key={delivery?.id?.slice(-4) + "_" + item.id}>
                <Table.Cell className="text-wrap">{item.title}</Table.Cell>
                <Table.Cell className="text-right">
                  {item.quantity as number}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
      <div className="flex gap-4 justify-end">
        {type === "delivery_partner" && delivery_partner && (
          <DeliveryPartnerDeliveryButtons delivery={delivery} delivery_partner={delivery_partner} />
        )}
        {type === "shop" && (
          <ShopDeliveryButtons delivery={delivery} />
        )}
      </div>
    </Container>
  );
}
