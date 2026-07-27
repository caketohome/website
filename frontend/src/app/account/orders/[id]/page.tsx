import OrderDetailClient from "@frontend/components/store/account/order-detail-client";

/**
 * Account order detail page — renders the full order lifecycle view for a
 * customer's own order. Auth-gated by the account layout.
 */
export default function AccountOrderDetailPage({
    params,
}: {
    params: { id: string };
}) {
    return <OrderDetailClient orderId={params.id} />;
}
