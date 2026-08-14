"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heading, Text, Button, Input, Textarea, Label, Badge, StatusBadge, Container } from "@medusajs/ui";
import {
    clientGetOrder as getOrder,
    clientCancelOrder as cancelOrder,
    clientRequestReschedule as requestReschedule,
    clientAddOrderNote as addOrderNote,
    clientDownloadInvoice as downloadInvoice,
} from "../../../lib/data/orders-client";
import {
    type OrderDetail,
    type TimelineEntry,
} from "../../../lib/data/orders";

/**
 * Order detail client component — renders the full order lifecycle timeline,
 * delivery proofs, refunds, and customer actions (cancel, reschedule, note,
 * download invoice, 1-click reorder).
 */
export default function OrderDetailClient({ orderId }: { orderId: string }) {
    const router = useRouter();
    const [order, setOrder] = useState<OrderDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Action states
    const [cancelReason, setCancelReason] = useState("");
    const [showCancel, setShowCancel] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState("");
    const [rescheduleReason, setRescheduleReason] = useState("");
    const [showReschedule, setShowReschedule] = useState(false);
    const [noteBody, setNoteBody] = useState("");
    const [showNote, setShowNote] = useState(false);
    const [busy, setBusy] = useState(false);
    const [actionMsg, setActionMsg] = useState<string | null>(null);

    const refetch = async () => {
        try {
            const { order: o } = await getOrder(orderId);
            setOrder(o);
        } catch (e) {
            setError((e as Error).message);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const { order: o } = await getOrder(orderId);
                setOrder(o);
            } catch (e) {
                setError((e as Error).message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [orderId]);

    const handleReorder = async () => {
        setBusy(true);
        try {
            const items = (order as any)?.items || [];
            for (const item of items) {
                const prodId = item.product_id || item.id;
                if (prodId) {
                    await addToCartAction({
                        product_id: prodId,
                        quantity: Number(item.quantity || 1),
                    }).catch(() => null);
                }
            }
            setActionMsg("🎉 Items added to cart! Redirecting to checkout...");
            setTimeout(() => {
                router.push("/checkout");
            }, 600);
        } catch (e: any) {
            setActionMsg(`Reorder failed: ${e.message}`);
        } finally {
            setBusy(false);
        }
    };

    const handleCancel = async () => {
        if (!cancelReason.trim()) return;
        setBusy(true);
        try {
            await cancelOrder(orderId, cancelReason);
            setActionMsg("Order cancelled.");
            setShowCancel(false);
            setCancelReason("");
            await refetch();
        } catch (e) {
            setActionMsg(`Cancel failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    const handleReschedule = async () => {
        if (!rescheduleDate) return;
        setBusy(true);
        try {
            await requestReschedule(orderId, {
                requested_date: rescheduleDate,
                reason: rescheduleReason || undefined,
            });
            setActionMsg("Reschedule request submitted.");
            setShowReschedule(false);
            setRescheduleDate("");
            setRescheduleReason("");
            await refetch();
        } catch (e) {
            setActionMsg(`Reschedule failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    const handleNote = async () => {
        if (!noteBody.trim()) return;
        setBusy(true);
        try {
            await addOrderNote(orderId, noteBody);
            setActionMsg("Note added.");
            setShowNote(false);
            setNoteBody("");
            await refetch();
        } catch (e) {
            setActionMsg(`Note failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    const handleInvoice = async () => {
        setBusy(true);
        try {
            const blob = await downloadInvoice(orderId);
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `invoice-${order?.display_number ?? orderId}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            setActionMsg(`Invoice failed: ${(e as Error).message}`);
        } finally {
            setBusy(false);
        }
    };

    if (loading) {
        return (
            <Container className="p-6">
                <Text>Loading order…</Text>
            </Container>
        );
    }

    if (error || !order) {
        return (
            <Container className="p-6 flex flex-col gap-3">
                <Text className="text-ui-fg-subtle">
                    {error ?? "Order not found."}
                </Text>
                <Button size="small" variant="secondary" onClick={() => history.back()}>
                    ← Back
                </Button>
            </Container>
        );
    }

    const cancellable = ["pending", "confirmed", "accepted"].includes(order.status);

    return (
        <Container className="p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button size="small" variant="transparent" onClick={() => history.back()}>
                        ← Back
                    </Button>
                    <Heading level="h1">Order {order.display_number ?? order.order_id}</Heading>
                    <StatusBadge color={statusColor(order.status)}>{order.status}</StatusBadge>
                </div>
                <div className="flex gap-2 flex-wrap items-center">
                    <Button size="small" variant="secondary" onClick={handleReorder} disabled={busy} className="bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold border-rose-200">
                        🔄 Reorder
                    </Button>
                    <Button size="small" variant="secondary" onClick={handleInvoice} disabled={busy}>
                        Download Invoice
                    </Button>
                    {cancellable && (
                        <Button
                            size="small"
                            variant={cancellable ? "danger" : "transparent"}
                            onClick={() => setShowCancel((s) => !s)}
                        >
                            Cancel Order
                        </Button>
                    )}
                    <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setShowReschedule((s) => !s)}
                    >
                        Reschedule
                    </Button>
                    <Button
                        size="small"
                        variant="transparent"
                        onClick={() => setShowNote((s) => !s)}
                    >
                        Add Note
                    </Button>
                </div>
            </div>

            {actionMsg && (
                <Text className="text-ui-fg-subtle" size="small">
                    {actionMsg}
                </Text>
            )}

            {/* Order summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard label="Placed" value={order.placed_at ? new Date(order.placed_at).toLocaleDateString() : "—"} />
                <SummaryCard label="Items" value={String(order.item_count ?? 0)} />
                <SummaryCard
                    label="Total"
                    value={order.total_amount != null ? `${order.currency_code ?? ""} ${order.total_amount}` : "—"}
                />
                <SummaryCard
                    label="Delivery date"
                    value={order.delivery_date ?? "—"}
                />
            </div>

            {/* Inline action forms */}
            {showCancel && (
                <div className="border border-ui-border-base rounded p-4 flex flex-col gap-2 max-w-md">
                    <Heading level="h3">Cancel this order</Heading>
                    <Label>Reason</Label>
                    <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
                    <Button size="small" variant="danger" onClick={handleCancel} disabled={busy || !cancelReason.trim()}>
                        {busy ? "Cancelling…" : "Confirm cancel"}
                    </Button>
                </div>
            )}

            {showReschedule && (
                <div className="border border-ui-border-base rounded p-4 flex flex-col gap-2 max-w-md">
                    <Heading level="h3">Request reschedule</Heading>
                    <Label>Requested delivery date</Label>
                    <Input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} />
                    <Label>Reason (optional)</Label>
                    <Textarea value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} />
                    <Button size="small" onClick={handleReschedule} disabled={busy || !rescheduleDate}>
                        {busy ? "Submitting…" : "Submit request"}
                    </Button>
                </div>
            )}

            {showNote && (
                <div className="border border-ui-border-base rounded p-4 flex flex-col gap-2 max-w-md">
                    <Heading level="h3">Add a note</Heading>
                    <Label>Message (visible to bakery staff)</Label>
                    <Textarea value={noteBody} onChange={(e) => setNoteBody(e.target.value)} />
                    <Button size="small" onClick={handleNote} disabled={busy || !noteBody.trim()}>
                        {busy ? "Adding…" : "Add note"}
                    </Button>
                </div>
            )}

            {/* Timeline */}
            <div className="flex flex-col gap-3">
                <Heading level="h2">Order Timeline</Heading>
                {order.timeline.length === 0 ? (
                    <Text className="text-ui-fg-subtle">No timeline events yet.</Text>
                ) : (
                    <ol className="flex flex-col gap-2">
                        {order.timeline.map((e: TimelineEntry) => (
                            <li
                                key={e.id}
                                className="border-l-2 border-ui-border-base pl-3 py-1"
                            >
                                <div className="flex items-center justify-between">
                                    <Text className="font-medium">{e.title}</Text>
                                    <Badge size="small" color="grey">
                                        {e.type}
                                    </Badge>
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

            {/* Delivery proofs */}
            {order.delivery_proofs.length > 0 && (
                <div className="flex flex-col gap-3">
                    <Heading level="h2">Delivery Proof</Heading>
                    <div className="flex flex-wrap gap-4">
                        {order.delivery_proofs.map((p) => (
                            <div key={p.id} className="flex flex-col gap-2">
                                {p.photo_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.photo_url}
                                        alt="Delivery proof"
                                        loading="lazy"
                                        className="max-h-48 rounded border border-ui-border-base"
                                    />
                                )}
                                {p.signature_url && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={p.signature_url}
                                        alt="Customer signature"
                                        loading="lazy"
                                        className="max-h-32 rounded border border-ui-border-base"
                                    />
                                )}
                                {p.note && (
                                    <Text size="small" className="text-ui-fg-subtle">
                                        {p.note}
                                    </Text>
                                )}
                                <Text size="small" className="text-ui-fg-muted">
                                    {new Date(p.captured_at).toLocaleString()}
                                </Text>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Refunds */}
            {order.refunds.length > 0 && (
                <div className="flex flex-col gap-3">
                    <Heading level="h2">Refunds</Heading>
                    {order.refunds.map((r) => (
                        <div key={r.id} className="border border-ui-border-base rounded p-3">
                            <div className="flex items-center justify-between">
                                <Text className="font-medium">
                                    {r.amount} via {r.refund_channel}
                                </Text>
                                <StatusBadge color={r.status === "processed" ? "green" : "red"}>
                                    {r.status}
                                </StatusBadge>
                            </div>
                            {r.reason && (
                                <Text className="text-ui-fg-subtle">{r.reason}</Text>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </Container>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="border border-ui-border-base rounded p-3 flex flex-col gap-1">
            <Text size="small" className="text-ui-fg-muted">
                {label}
            </Text>
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
