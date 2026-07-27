import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useState } from "react";
import {
    Container,
    Heading,
    Input,
    Label,
    Button,
    Text,
    Select,
    Textarea,
    Badge,
    StatusBadge,
    Table,
} from "@medusajs/ui";
import { ClipboardList } from "lucide-react";
import React from "react";
import {
    useOrderLifecycleList,
    useOrderLifecycleDetail,
    transitionOrderStatus,
    addOrderNote,
    issueRefund,
    resolveRescheduleRequest,
    assignStaff,
    addDeliveryProof,
    type OrderLifecycleSummary,
    type TimelineEntry,
} from "../../hooks/use-order-lifecycle";

const OrderIcon: React.ForwardRefExoticComponent<
    React.RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props, ref) => (
    <ClipboardList ref={ref} size={16} {...props} />
));

const STATUS_OPTIONS = [
    "pending",
    "confirmed",
    "accepted",
    "packed",
    "ready",
    "out_for_delivery",
    "delivered",
    "failed_delivery",
    "returned",
    "cancelled",
    "refunded",
];

const OrderLifecyclePage = () => {
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("");

    if (selectedOrderId) {
        return (
            <OrderDetailPanel
                orderId={selectedOrderId}
                onBack={() => setSelectedOrderId(null)}
            />
        );
    }

    return (
        <OrderListPanel
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onSelect={setSelectedOrderId}
        />
    );
};

// ── Order List Panel ────────────────────────────────────────────────────────

function OrderListPanel({
    statusFilter,
    setStatusFilter,
    onSelect,
}: {
    statusFilter: string;
    setStatusFilter: (s: string) => void;
    onSelect: (id: string) => void;
}) {
    const { data, loading } = useOrderLifecycleList(
        statusFilter || undefined,
        100,
        0
    );

    return (
        <Container className="p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <Heading level="h1">Order Lifecycle</Heading>
                <div className="flex items-center gap-2">
                    <Label>Status filter</Label>
                    <Select
                        value={statusFilter}
                        onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="All statuses" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="all">All statuses</Select.Item>
                            {STATUS_OPTIONS.map((s) => (
                                <Select.Item key={s} value={s}>
                                    {s}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>
            </div>

            {loading ? (
                <Text>Loading orders…</Text>
            ) : data && data.orders.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Order</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Items</Table.HeaderCell>
                            <Table.HeaderCell>Total</Table.HeaderCell>
                            <Table.HeaderCell>Placed</Table.HeaderCell>
                            <Table.HeaderCell>Action</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.orders.map((o: OrderLifecycleSummary) => (
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
                                <Table.Cell>
                                    <Button
                                        size="small"
                                        variant="secondary"
                                        onClick={() => onSelect(o.order_id)}
                                    >
                                        Manage
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text className="text-ui-fg-subtle">No orders found.</Text>
            )}
        </Container>
    );
}

// ── Order Detail Panel ──────────────────────────────────────────────────────

function OrderDetailPanel({
    orderId,
    onBack,
}: {
    orderId: string;
    onBack: () => void;
}) {
    const { data, loading, refetch } = useOrderLifecycleDetail(orderId);
    const [tab, setTab] = useState<"timeline" | "status" | "notes" | "refunds" | "reschedule" | "staff" | "proof">(
        "timeline"
    );

    if (loading || !data) {
        return (
            <Container className="p-6">
                <Text>Loading order…</Text>
                <Button variant="transparent" size="small" onClick={onBack}>
                    ← Back
                </Button>
            </Container>
        );
    }

    return (
        <Container className="p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="transparent" size="small" onClick={onBack}>
                        ← Back
                    </Button>
                    <Heading level="h1">
                        Order {data.display_id ?? data.id}
                    </Heading>
                    <StatusBadge color={statusColor(data.lifecycle_status)}>
                        {data.lifecycle_status}
                    </StatusBadge>
                </div>
            </div>

            <div className="flex gap-2 flex-wrap">
                {(["timeline", "status", "notes", "refunds", "reschedule", "staff", "proof"] as const).map((t) => (
                    <Button
                        key={t}
                        variant={tab === t ? "secondary" : "transparent"}
                        size="small"
                        onClick={() => setTab(t)}
                    >
                        {t === "status" ? "Status Transition" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </Button>
                ))}
            </div>

            {tab === "timeline" && <TimelineTab entries={data.timeline} />}
            {tab === "status" && (
                <StatusTab orderId={orderId} currentStatus={data.lifecycle_status} onDone={refetch} />
            )}
            {tab === "notes" && <NotesTab orderId={orderId} notes={data.notes} onDone={refetch} />}
            {tab === "refunds" && (
                <RefundsTab orderId={orderId} refunds={data.refunds} onDone={refetch} />
            )}
            {tab === "reschedule" && (
                <RescheduleTab
                    orderId={orderId}
                    requests={data.reschedule_requests}
                    onDone={refetch}
                />
            )}
            {tab === "staff" && (
                <StaffTab orderId={orderId} assignments={data.staff_assignments} onDone={refetch} />
            )}
            {tab === "proof" && (
                <ProofTab orderId={orderId} proofs={data.delivery_proofs} onDone={refetch} />
            )}
        </Container>
    );
}

// ── Timeline Tab ────────────────────────────────────────────────────────────

function TimelineTab({ entries }: { entries: TimelineEntry[] }) {
    if (entries.length === 0) {
        return <Text className="text-ui-fg-subtle">No timeline events yet.</Text>;
    }
    return (
        <div className="flex flex-col gap-2">
            {entries.map((e) => (
                <div
                    key={e.id}
                    className="border border-ui-border-base rounded p-3 flex flex-col gap-1"
                >
                    <div className="flex items-center justify-between">
                        <Text className="font-medium">{e.title}</Text>
                        <Badge size="small" color={e.is_customer_visible ? "green" : "grey"}>
                            {e.type}
                        </Badge>
                    </div>
                    {e.description && (
                        <Text className="text-ui-fg-subtle">{e.description}</Text>
                    )}
                    <Text size="small" className="text-ui-fg-muted">
                        {new Date(e.timestamp).toLocaleString()}
                        {e.actor_type ? ` · by ${e.actor_type}` : ""}
                    </Text>
                </div>
            ))}
        </div>
    );
}

// ── Status Transition Tab ───────────────────────────────────────────────────

function StatusTab({
    orderId,
    currentStatus,
    onDone,
}: {
    orderId: string;
    currentStatus: string;
    onDone: () => void;
}) {
    const [toStatus, setToStatus] = useState("");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!toStatus) return;
        setBusy(true);
        await transitionOrderStatus(orderId, toStatus, reason || undefined);
        setBusy(false);
        setToStatus("");
        setReason("");
        onDone();
    };

    return (
        <div className="flex flex-col gap-3 max-w-md">
            <Text>
                Current status: <StatusBadge color={statusColor(currentStatus)}>{currentStatus}</StatusBadge>
            </Text>
            <div>
                <Label>Transition to</Label>
                <Select value={toStatus} onValueChange={setToStatus}>
                    <Select.Trigger>
                        <Select.Value placeholder="Select status" />
                    </Select.Trigger>
                    <Select.Content>
                        {STATUS_OPTIONS.map((s) => (
                            <Select.Item key={s} value={s}>
                                {s}
                            </Select.Item>
                        ))}
                    </Select.Content>
                </Select>
            </div>
            <div>
                <Label>Reason (optional)</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button size="small" onClick={submit} disabled={busy || !toStatus}>
                {busy ? "Transitioning…" : "Apply transition"}
            </Button>
        </div>
    );
}

// ── Notes Tab ────────────────────────────────────────────────────────────────

function NotesTab({
    orderId,
    notes,
    onDone,
}: {
    orderId: string;
    notes: { id: string; note_type: string; body: string; created_at?: string }[];
    onDone: () => void;
}) {
    const [noteType, setNoteType] = useState<"internal" | "customer">("internal");
    const [body, setBody] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!body.trim()) return;
        setBusy(true);
        await addOrderNote(orderId, noteType, body);
        setBusy(false);
        setBody("");
        onDone();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 max-w-md">
                <div>
                    <Label>Note type</Label>
                    <Select value={noteType} onValueChange={(v) => setNoteType(v as "internal" | "customer")}>
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="internal">Internal (staff only)</Select.Item>
                            <Select.Item value="customer">Customer-visible</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <div>
                    <Label>Body</Label>
                    <Textarea value={body} onChange={(e) => setBody(e.target.value)} />
                </div>
                <Button size="small" onClick={submit} disabled={busy || !body.trim()}>
                    {busy ? "Adding…" : "Add note"}
                </Button>
            </div>
            <div className="flex flex-col gap-2">
                {notes.map((n) => (
                    <div key={n.id} className="border border-ui-border-base rounded p-3">
                        <div className="flex items-center justify-between">
                            <Badge size="small" color={n.note_type === "customer" ? "green" : "grey"}>
                                {n.note_type}
                            </Badge>
                            <Text size="small" className="text-ui-fg-muted">
                                {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                            </Text>
                        </div>
                        <Text>{n.body}</Text>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Refunds Tab ──────────────────────────────────────────────────────────────

function RefundsTab({
    orderId,
    refunds,
    onDone,
}: {
    orderId: string;
    refunds: { id: string; amount: number; refund_channel: string; reason?: string | null; status: string; created_at?: string }[];
    onDone: () => void;
}) {
    const [amount, setAmount] = useState("");
    const [channel, setChannel] = useState<"payment_provider" | "wallet" | "mixed">("payment_provider");
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const amt = Number(amount);
        if (!amt || amt <= 0) return;
        setBusy(true);
        await issueRefund(orderId, { amount: amt, refund_channel: channel, reason: reason || undefined });
        setBusy(false);
        setAmount("");
        setReason("");
        onDone();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 max-w-md">
                <div>
                    <Label>Amount (smallest currency unit)</Label>
                    <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                    />
                </div>
                <div>
                    <Label>Refund channel</Label>
                    <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="payment_provider">Payment provider</Select.Item>
                            <Select.Item value="wallet">Wallet</Select.Item>
                            <Select.Item value="mixed">Mixed</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <div>
                    <Label>Reason (optional)</Label>
                    <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
                </div>
                <Button size="small" onClick={submit} disabled={busy || !amount}>
                    {busy ? "Issuing…" : "Issue refund"}
                </Button>
            </div>
            <div className="flex flex-col gap-2">
                {refunds.map((r) => (
                    <div key={r.id} className="border border-ui-border-base rounded p-3">
                        <div className="flex items-center justify-between">
                            <Text className="font-medium">{r.amount} via {r.refund_channel}</Text>
                            <StatusBadge color={r.status === "processed" ? "green" : "red"}>
                                {r.status}
                            </StatusBadge>
                        </div>
                        {r.reason && <Text className="text-ui-fg-subtle">{r.reason}</Text>}
                        <Text size="small" className="text-ui-fg-muted">
                            {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                        </Text>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Reschedule Tab ──────────────────────────────────────────────────────────

function RescheduleTab({
    orderId,
    requests,
    onDone,
}: {
    orderId: string;
    requests: { id: string; status: string; requested_date?: string | null; reason?: string | null; created_at?: string }[];
    onDone: () => void;
}) {
    const [busyId, setBusyId] = useState<string | null>(null);

    const resolve = async (requestId: string, status: "approved" | "rejected") => {
        setBusyId(requestId);
        await resolveRescheduleRequest(orderId, requestId, status);
        setBusyId(null);
        onDone();
    };

    return (
        <div className="flex flex-col gap-2">
            {requests.length === 0 ? (
                <Text className="text-ui-fg-subtle">No reschedule requests.</Text>
            ) : (
                requests.map((r) => (
                    <div key={r.id} className="border border-ui-border-base rounded p-3 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                            <Text>
                                Requested: {r.requested_date ?? "new slot"}
                            </Text>
                            <StatusBadge color={r.status === "requested" ? "orange" : r.status === "approved" ? "green" : "red"}>
                                {r.status}
                            </StatusBadge>
                        </div>
                        {r.reason && <Text className="text-ui-fg-subtle">{r.reason}</Text>}
                        <Text size="small" className="text-ui-fg-muted">
                            {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
                        </Text>
                        {r.status === "requested" && (
                            <div className="flex gap-2">
                                <Button
                                    size="small"
                                    variant="secondary"
                                    onClick={() => resolve(r.id, "approved")}
                                    disabled={busyId === r.id}
                                >
                                    Approve
                                </Button>
                                <Button
                                    size="small"
                                    variant="danger"
                                    onClick={() => resolve(r.id, "rejected")}
                                    disabled={busyId === r.id}
                                >
                                    Reject
                                </Button>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
}

// ── Staff Assignment Tab ────────────────────────────────────────────────────

function StaffTab({
    orderId,
    assignments,
    onDone,
}: {
    orderId: string;
    assignments: { id: string; role: string; staff_id: string; staff_name?: string | null; is_active: boolean; created_at?: string }[];
    onDone: () => void;
}) {
    const [role, setRole] = useState("baker");
    const [staffId, setStaffId] = useState("");
    const [staffName, setStaffName] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!staffId.trim()) return;
        setBusy(true);
        await assignStaff(orderId, role, staffId, staffName || undefined);
        setBusy(false);
        setStaffId("");
        setStaffName("");
        onDone();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 max-w-md">
                <div>
                    <Label>Role</Label>
                    <Select value={role} onValueChange={setRole}>
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="baker">Baker</Select.Item>
                            <Select.Item value="packer">Packer</Select.Item>
                            <Select.Item value="delivery_partner">Delivery partner</Select.Item>
                            <Select.Item value="branch_manager">Branch manager</Select.Item>
                            <Select.Item value="staff">Staff</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <div>
                    <Label>Staff ID</Label>
                    <Input value={staffId} onChange={(e) => setStaffId(e.target.value)} />
                </div>
                <div>
                    <Label>Staff name (optional)</Label>
                    <Input value={staffName} onChange={(e) => setStaffName(e.target.value)} />
                </div>
                <Button size="small" onClick={submit} disabled={busy || !staffId.trim()}>
                    {busy ? "Assigning…" : "Assign staff"}
                </Button>
            </div>
            <div className="flex flex-col gap-2">
                {assignments.map((a) => (
                    <div key={a.id} className="border border-ui-border-base rounded p-3 flex items-center justify-between">
                        <div>
                            <Text className="font-medium">{a.role}: {a.staff_name ?? a.staff_id}</Text>
                            <Text size="small" className="text-ui-fg-muted">
                                {a.created_at ? new Date(a.created_at).toLocaleString() : ""}
                            </Text>
                        </div>
                        <Badge size="small" color={a.is_active ? "green" : "grey"}>
                            {a.is_active ? "active" : "superseded"}
                        </Badge>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Delivery Proof Tab ───────────────────────────────────────────────────────

function ProofTab({
    orderId,
    proofs,
    onDone,
}: {
    orderId: string;
    proofs: { id: string; photo_url?: string | null; signature_url?: string | null; note?: string | null; captured_at: string }[];
    onDone: () => void;
}) {
    const [photoUrl, setPhotoUrl] = useState("");
    const [signatureUrl, setSignatureUrl] = useState("");
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        if (!photoUrl && !signatureUrl) return;
        setBusy(true);
        await addDeliveryProof(orderId, {
            photo_url: photoUrl || undefined,
            signature_url: signatureUrl || undefined,
            note: note || undefined,
        });
        setBusy(false);
        setPhotoUrl("");
        setSignatureUrl("");
        setNote("");
        onDone();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 max-w-md">
                <div>
                    <Label>Photo URL (Media Module)</Label>
                    <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} />
                </div>
                <div>
                    <Label>Signature URL (Media Module)</Label>
                    <Input value={signatureUrl} onChange={(e) => setSignatureUrl(e.target.value)} />
                </div>
                <div>
                    <Label>Note (optional)</Label>
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                <Button size="small" onClick={submit} disabled={busy || (!photoUrl && !signatureUrl)}>
                    {busy ? "Uploading…" : "Add proof"}
                </Button>
            </div>
            <div className="flex flex-col gap-2">
                {proofs.map((p) => (
                    <div key={p.id} className="border border-ui-border-base rounded p-3 flex flex-col gap-2">
                        <Text size="small" className="text-ui-fg-muted">
                            {new Date(p.captured_at).toLocaleString()}
                        </Text>
                        {p.photo_url && (
                            <img src={p.photo_url} alt="Delivery proof" className="max-h-40 rounded" />
                        )}
                        {p.signature_url && (
                            <img src={p.signature_url} alt="Signature" className="max-h-24 rounded" />
                        )}
                        {p.note && <Text className="text-ui-fg-subtle">{p.note}</Text>}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
        case "requested":
            return "orange";
        case "returned":
            return "purple";
        default:
            return "grey";
    }
}

export const config = defineRouteConfig({
    label: "Order Lifecycle",
    icon: OrderIcon,
});

export default OrderLifecyclePage;
