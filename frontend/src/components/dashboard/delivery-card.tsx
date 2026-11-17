import { DeliveryDTO, DeliveryPartnerDTO } from "@frontend/lib/types";
import { Container, Heading, Table } from "@medusajs/ui";
import DeliveryPartnerDeliveryButtons from "./delivery-partner/delivery-buttons";
import { DeliveryPartnerDeliveryStatusBadge } from "./delivery-partner/delivery-status-badge";
import ShopDeliveryButtons from "./shop/delivery-buttons";
import { ShopDeliveryStatusBadge } from "./shop/delivery-status-badge";
import { extractDeliveryCoordinates } from "@frontend/lib/location/directions";

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
      <div className="flex justify-between gap-2 flex-wrap items-start">
        <div className="flex flex-col gap-0.5">
          <Heading className="text-large font-bold flex items-center gap-1.5 text-ui-fg-base">
            Order #{delivery.order?.display_number || delivery.order?.order_number || (delivery as any).order_number || delivery.order_id || delivery.id}
          </Heading>
          <span className="font-mono text-[10px] text-ui-fg-muted font-normal">
            Ref: {delivery.order_id || delivery.id}
          </span>
        </div>
        {type === "delivery_partner" && <DeliveryPartnerDeliveryStatusBadge delivery={delivery} />}
        {type === "shop" && (
          <ShopDeliveryStatusBadge delivery={delivery} />
        )}
      </div>
      {/* Recipient Details & Delivery Notes */}
      {(() => {
        const recipientName = typeof delivery.recipient_name === "string" && delivery.recipient_name.trim()
          ? delivery.recipient_name.trim()
          : typeof delivery.order?.shipping_address?.first_name === "string"
            ? `${delivery.order.shipping_address.first_name} ${delivery.order.shipping_address.last_name || ""}`.trim()
            : typeof delivery.order?.customer_name === "string" && delivery.order.customer_name.trim()
              ? delivery.order.customer_name.trim()
              : "Customer";

        const recipientPhone = typeof delivery.recipient_phone === "string" && delivery.recipient_phone.trim()
          ? delivery.recipient_phone.trim()
          : typeof delivery.order?.shipping_address?.phone === "string"
            ? delivery.order.shipping_address.phone.trim()
            : typeof delivery.order?.customer_phone === "string" && delivery.order.customer_phone.trim()
              ? delivery.order.customer_phone.trim()
              : "";

        const recipientAddress = typeof delivery.recipient_address === "string" && delivery.recipient_address.trim()
          ? delivery.recipient_address.trim()
          : typeof delivery.order?.shipping_address?.address_1 === "string"
            ? delivery.order.shipping_address.address_1.trim()
            : typeof delivery.order?.delivery_address === "string" && delivery.order.delivery_address.trim()
              ? delivery.order.delivery_address.trim()
              : "Delivery Location";

        const recipientPincode = typeof delivery.recipient_pincode === "string" && delivery.recipient_pincode.trim()
          ? delivery.recipient_pincode.trim()
          : typeof delivery.order?.shipping_address?.postal_code === "string"
            ? delivery.order.shipping_address.postal_code.trim()
            : typeof delivery.order?.pincode === "string" && delivery.order.pincode.trim()
              ? delivery.order.pincode.trim()
              : "";

        const landmark = typeof delivery.recipient_landmark === "string" && delivery.recipient_landmark.trim() ? delivery.recipient_landmark.trim() : null;
        const instructions = typeof delivery.delivery_instructions === "string" && delivery.delivery_instructions.trim() ? delivery.delivery_instructions.trim() : null;
        const giftMsg = typeof delivery.gift_message === "string" && delivery.gift_message.trim() ? delivery.gift_message.trim() : null;
        const hasDeliveryOtp = Boolean(delivery.delivery_otp);

        const coords = extractDeliveryCoordinates(delivery);

        return (
          <div className="flex flex-col gap-1 bg-ui-bg-subtle p-3 rounded-lg border text-xs">
            <span className="font-semibold text-rose-600 dark:text-rose-400">
              👤 Recipient: {recipientName}
            </span>
            {recipientPhone && <span>📞 Phone: {recipientPhone}</span>}
            <span>📍 Address: {recipientAddress}{recipientPincode ? ` (${recipientPincode})` : ""}</span>
            {coords.hasCoords && typeof coords.latitude === "number" && typeof coords.longitude === "number" && (
              <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 flex items-center gap-1 font-bold">
                🎯 GPS Coordinates: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              </span>
            )}
            {landmark && <span>🏠 Landmark: {landmark}</span>}
            {instructions && <span className="italic text-ui-fg-muted">💬 Note: &quot;{instructions}&quot;</span>}
            {giftMsg && <span className="font-medium text-brand-primary dark:text-brand-primary">🎁 Gift Card Message Included</span>}
            {hasDeliveryOtp && (
              <span className="mt-1 font-bold text-brand-gold-dark bg-brand-gold-light px-2 py-0.5 rounded w-fit">
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
            {items?.map((item: any, idx: number) => (
              <Table.Row key={`${delivery?.id || 'del'}_${item.id || idx}`}>
                <Table.Cell className="text-wrap">{item.title || item.name || "Artisan Cake"}</Table.Cell>
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
