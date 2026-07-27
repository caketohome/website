import { Suspense } from "react";
import OrderTrackingClient from "@frontend/components/store/account/order-tracking-client";

/**
 * Public order tracking page — `/track?order=<id>`. Allows a customer (or
 * anyone with the order id) to view the customer-visible timeline of an order.
 * This is the storefront order tracking entry point referenced in the Phase 5
 * requirements ("Storefront Order Tracking").
 */
export default function TrackPage() {
    return (
        <Suspense fallback={<div className="p-6">Loading…</div>}>
            <OrderTrackingClient />
        </Suspense>
    );
}
