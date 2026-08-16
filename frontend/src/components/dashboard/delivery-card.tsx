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
      {(() => {
        const recipientName = typeof delivery.recipient_name === "string" && delivery.recipient_name
          ? delivery.recipient_name
          : typeof delivery.order?.shipping_address?.first_name === "string"
            ? `${delivery.order.shipping_address.first_name} ${delivery.order.shipping_address.last_name || ""}`.trim()
            : "Customer";

        const recipientPhone = typeof delivery.recipient_phone === "string" && delivery.recipient_phone
          ? delivery.recipient_phone
          : typeof delivery.order?.shipping_address?.phone === "string"
            ? delivery.order.shipping_address.phone
            : "+91 98765 43210";

        const recipientAddress = typeof delivery.recipient_address === "string" && delivery.recipient_address
          ? delivery.recipient_address
          : typeof delivery.order?.shipping_address?.address_1 === "string"
            ? delivery.order.shipping_address.address_1
            : "Delivery Location";

        const recipientPincode = typeof delivery.recipient_pincode === "string" && delivery.recipient_pincode
          ? delivery.recipient_pincode
          : typeof delivery.order?.shipping_address?.postal_code === "string"
            ? delivery.order.shipping_address.postal_code
            : "560038";

        const landmark = typeof delivery.recipient_landmark === "string" ? delivery.recipient_landmark : null;
        const instructions = typeof delivery.delivery_instructions === "string" ? delivery.delivery_instructions : null;
        const giftMsg = typeof delivery.gift_message === "string" ? delivery.gift_message : null;
        const hasDeliveryOtp = Boolean(delivery.delivery_otp);

        return (
          <div className="flex flex-col gap-1 bg-ui-bg-subtle p-3 rounded-lg border text-xs">
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              👤 Recipient: {recipientName}
            </span>
            <span>📞 Phone: {recipientPhone}</span>
            <span>📍 Address: {recipientAddress} ({recipientPincode})</span>
            {landmark && <span>🏠 Landmark: {landmark}</span>}
            {instructions && <span className="italic text-ui-fg-muted">💬 Note: &quot;{instructions}&quot;</span>}
            {giftMsg && <span className="font-medium text-purple-600 dark:text-purple-400">🎁 Gift Card Message Included</span>}
            {hasDeliveryOtp && (
              <span className="mt-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded w-fit">
                🔑 Delivery Verification OTP Required
              </span>
            )}
          </div>
        );
      })()}

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
