import { listOrders, type OrderSummary } from "../../../lib/data/orders";
import { getAuthHeaders } from "../../../lib/data/cookies";
import { Heading, Text, StatusBadge, Table, Container } from "@medusajs/ui";
import Link from "next/link";

/**
 * Account order history page — server component that fetches the
 * authenticated customer's order history via the order lifecycle store API
 * and renders it as a table. Each row links to the order detail page.
 */
export default async function AccountOrdersPage() {
    let orders: OrderSummary[] = [];
    let error: string | null = null;

    try {
        const result = await listOrders({ limit: 50, offset: 0 });
        orders = result.orders ?? [];
    } catch (e) {
        error = (e as Error).message;
    }

    return (
        <Container className="p-6 flex flex-col gap-4">
            <Heading level="h2">Order History</Heading>

            {error ? (
                <Text className="text-ui-fg-subtle">
                    Unable to load your orders. {error}
                </Text>
            ) : orders.length === 0 ? (
                <Text className="text-ui-fg-subtle">
                    You have not placed any orders yet. Once you place an order, it
                    will appear here with its live status and timeline.
                </Text>
            ) : (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Order</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Items</Table.HeaderCell>
                            <Table.HeaderCell>Total</Table.HeaderCell>
                            <Table.HeaderCell>Placed</Table.HeaderCell>
                            <Table.HeaderCell>Delivery</Table.HeaderCell>
                            <Table.HeaderCell>Action</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {orders.map((o) => (
                            <Table.Row key={o.order_id}>
                                <Table.Cell>{o.display_number ?? o.order_id}</Table.Cell>
                                <Table.Cell>
                                    <StatusBadge color={statusColor(o.status)}>
                                        {o.status}
                                    </StatusBadge>
                                </Table.Cell>
                                <Table.Cell>{o.item_count ?? 0}</Table.Cell>
                                <Table.Cell>
                                    {o.total_amount != null
                                        ? `${o.currency_code ?? ""} ${o.total_amount}`
                                        : "—"}
                                </Table.Cell>
                                <Table.Cell>
                                    {o.placed_at
                                        ? new Date(o.placed_at).toLocaleDateString()
                                        : "—"}
                                </Table.Cell>
                                <Table.Cell>{o.delivery_date ?? "—"}</Table.Cell>
                                <Table.Cell>
                                    <Link
                                        href={`/account/orders/${o.order_id}`}
                                        className="text-ui-fg-interactive hover:underline"
                                    >
                                        View
                                    </Link>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            )}
        </Container>
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
