"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Heading, Text, Input, Button, Badge, StatusBadge, Container } from "@medusajs/ui";
import { clientGetOrder } from "../../../lib/data/orders-client";
import { type OrderDetail, type TimelineEntry } from "../../../lib/data/orders";

/**
 * Public order tracking client — lets a customer enter an order id (or follow
 * a `/track?order=<id>` link) and view the customer-visible timeline. This is
 * the storefront order tracking widget.
 *
 * Note: the underlying `/store/orders/:id` endpoint is customer-authenticated,
 * so a logged-in customer can track their own orders. For fully public guest
 * tracking (e.g. by order id + phone), a future cycle can add a public
 * read-only tracking endpoint; the current implementation reuses the
 * authenticated order detail endpoint.
 */
export default function OrderTrackingClient() {
    const searchParams = useSearchParams();
    const initialOrderId = searchParams.get("order") ?? "";
    const [orderId, setOrderId] = useState(initialOrderId);
    const [submittedId, setSubmittedId] = useState(initialOrderId);
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!submittedId) return;
        const load = async () => {
            setLoading(true);
            setError(null);
            try {
                const { order: o } = await clientGetOrder(submittedId);
                setOrder(o);
            } catch (e) {
                setError((e as Error).message);
                setOrder(null);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [submittedId]);

    const submit = (e: React.FormEvent) => {
        e.preventDefault();
        setSubmittedId(orderId.trim());
    };

    return (
        <Container className="p-6 flex flex-col gap-6 max-w-3xl">
            <Heading level="h1">Track Your Order</Heading>

            <form onSubmit={submit} className="flex gap-2">
                <Input
                    placeholder="Enter your order ID"
                    value={orderId}
                    onChange={(e) => setOrderId(e.target.value)}
                    aria-label="Order ID"
                />
                <Button type="submit" disabled={!orderId.trim() || loading}>
                    {loading ? "Tracking…" : "Track"}
                </Button>
            </form>

            {error && (
                <Text className="text-ui-fg-subtle">
                    {error}
                </Text>
            )}

            {order && (
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <Heading level="h2">Order {order.display_number ?? order.order_id}</Heading>
                        <StatusBadge color={statusColor(order.status)}>{order.status}</StatusBadge>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <SummaryCard label="Placed" value={order.placed_at ? new Date(order.placed_at).toLocaleDateString() : "—"} />
                        <SummaryCard label="Items" value={String(order.item_count ?? 0)} />
                        <SummaryCard
                            label="Total"
                            value={order.total_amount != null ? `${order.currency_code ?? ""} ${order.total_amount}` : "—"}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Heading level="h3">Timeline</Heading>
                        {order.timeline.length === 0 ? (
                            <Text className="text-ui-fg-subtle">No updates yet.</Text>
                        ) : (
                            <ol className="flex flex-col gap-2">
                                {order.timeline.map((e: TimelineEntry) => (
                                    <li key={e.id} className="border-l-2 border-ui-border-base pl-3 py-1">
                                        <div className="flex items-center justify-between">
                                            <Text className="font-medium">{e.title}</Text>
                                            <Badge size="small" color="grey">{e.type}</Badge>
                                        </div>
                                        {e.description && (
                                            <Text className="text-ui-fg-subtle">{e.description}</Text>
                                        )}
                                        <Text size="small" className="text-ui-fg-muted">
                                            {new Date(e.timestamp).toLocaleString()}
                                        </Text>
                                    </li>
                                ))}
                            </ol>
                        )}
                    </div>

                    {order.delivery_proofs.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <Heading level="h3">Delivery Proof</Heading>
                            <div className="flex flex-wrap gap-4">
                                {order.delivery_proofs.map((p) => (
                                    <div key={p.id} className="flex flex-col gap-1">
                                        {p.photo_url && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={p.photo_url} alt="Delivery proof" loading="lazy" className="max-h-40 rounded border border-ui-border-base" />
                                        )}
                                        <Text size="small" className="text-ui-fg-muted">
                                            {new Date(p.captured_at).toLocaleString()}
                                        </Text>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Container>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-ui-border-base rounded p-3 flex flex-col gap-1">
            <Text size="small" className="text-ui-fg-muted">{label}</Text>
            <Text className="font-medium">{value}</Text>
        </div>
    );
}

function statusColor(status: string): "purple" | "blue" | "green" | "orange" | "red" | "grey" {
    switch (status) {
        case "delivered":
        case "refunded":
            return "green";
        case "cancelled":
        case "failed_delivery":
            return "red";
        case "out_for_delivery":
            return "blue";
        case "pending":
            return "orange";
        case "returned":
            return "purple";
        default:
            return "grey";
    }
}
