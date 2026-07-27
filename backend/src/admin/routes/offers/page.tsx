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
    Switch,
    Badge,
    StatusBadge,
    Table,
} from "@medusajs/ui";
import { OffersIcon } from "../../components/icons";
import {
    useOffers,
    createOffer,
    updateOffer,
    deleteOffer,
    type OfferEntry,
} from "../../hooks/use-offers";

// ─── Constants ─────────────────────────────────────────────────────────────────

const OFFER_TYPES = [
    "coupon",
    "promo_code",
    "flash_sale",
    "combo",
    "buy_x_get_y",
    "free_delivery",
    "free_gift",
    "bundle",
    "category_discount",
    "product_discount",
    "cart_discount",
    "wallet_cashback",
    "referral_reward",
    "loyalty_bonus",
    "birthday_offer",
    "anniversary_offer",
    "festival_campaign",
    "first_order_offer",
    "affiliate_reward",
    "influencer_reward",
    "gamification_reward",
    "branch_specific",
    "customer_segment",
    "scheduled_campaign",
] as const;

const OFFER_STATUSES = [
    "draft",
    "active",
    "scheduled",
    "expired",
    "disabled",
] as const;

const STATUS_COLORS: Record<string, "green" | "orange" | "red" | "blue" | "grey"> = {
    active: "green",
    draft: "grey",
    scheduled: "blue",
    expired: "red",
    disabled: "orange",
};

// ─── Page ──────────────────────────────────────────────────────────────────────

const OffersPage = () => {
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [filterType, setFilterType] = useState<string>("");
    const { data, loading, refetch } = useOffers({
        status: filterStatus || undefined,
        type: filterType || undefined,
    });

    // Form state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formName, setFormName] = useState("");
    const [formCode, setFormCode] = useState("");
    const [formType, setFormType] = useState<string>("coupon");
    const [formStatus, setFormStatus] = useState<string>("draft");
    const [formPriority, setFormPriority] = useState("0");
    const [formStartsAt, setFormStartsAt] = useState("");
    const [formEndsAt, setFormEndsAt] = useState("");
    const [formUsageLimit, setFormUsageLimit] = useState("");
    const [formPerCustomerLimit, setFormPerCustomerLimit] = useState("");
    const [formIsStackable, setFormIsStackable] = useState(false);
    const [formIsPublic, setFormIsPublic] = useState(true);
    const [formDescription, setFormDescription] = useState("");
    const [formConditions, setFormConditions] = useState("");
    const [formRewards, setFormRewards] = useState("");
    const [formBranchIds, setFormBranchIds] = useState("");
    const [formCustomerSegments, setFormCustomerSegments] = useState("");
    const [formMetadata, setFormMetadata] = useState("");

    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);

    const offers: OfferEntry[] = data?.offers ?? [];

    const resetForm = () => {
        setEditingId(null);
        setFormName("");
        setFormCode("");
        setFormType("coupon");
        setFormStatus("draft");
        setFormPriority("0");
        setFormStartsAt("");
        setFormEndsAt("");
        setFormUsageLimit("");
        setFormPerCustomerLimit("");
        setFormIsStackable(false);
        setFormIsPublic(true);
        setFormDescription("");
        setFormConditions("");
        setFormRewards("");
        setFormBranchIds("");
        setFormCustomerSegments("");
        setFormMetadata("");
    };

    const openCreate = () => {
        resetForm();
        setShowForm(true);
    };

    const openEdit = (offer: OfferEntry) => {
        setEditingId(offer.id);
        setFormName(offer.name);
        setFormCode(offer.code ?? "");
        setFormType(offer.type);
        setFormStatus(offer.status);
        setFormPriority(String(offer.priority));
        setFormStartsAt(offer.starts_at ? offer.starts_at.slice(0, 16) : "");
        setFormEndsAt(offer.ends_at ? offer.ends_at.slice(0, 16) : "");
        setFormUsageLimit(offer.usage_limit !== null ? String(offer.usage_limit) : "");
        setFormPerCustomerLimit(
            offer.per_customer_limit !== null
                ? String(offer.per_customer_limit)
                : ""
        );
        setFormIsStackable(offer.is_stackable);
        setFormIsPublic(offer.is_public);
        setFormDescription(offer.description ?? "");
        setFormConditions(offer.conditions ?? "");
        setFormRewards(offer.rewards ?? "");
        setFormBranchIds(offer.branch_ids ?? "");
        setFormCustomerSegments(offer.customer_segments ?? "");
        setFormMetadata(offer.metadata ?? "");
        setShowForm(true);
    };

    const parseJsonSafe = (raw: string): unknown => {
        if (!raw || raw.trim() === "") return undefined;
        try {
            return JSON.parse(raw);
        } catch {
            return undefined;
        }
    };

    const handleSave = async () => {
        if (!formName || !formType) {
            setMessage("Name and type are required");
            return;
        }

        // Validate JSON fields if provided
        const jsonFields = [
            { name: "conditions", value: formConditions },
            { name: "rewards", value: formRewards },
            { name: "branch_ids", value: formBranchIds },
            { name: "customer_segments", value: formCustomerSegments },
            { name: "metadata", value: formMetadata },
        ];
        for (const field of jsonFields) {
            if (field.value && field.value.trim() !== "") {
                try {
                    JSON.parse(field.value);
                } catch {
                    setMessage(`Invalid JSON in "${field.name}"`);
                    return;
                }
            }
        }

        setSaving(true);

        const payload: Record<string, unknown> = {
            name: formName,
            code: formCode || undefined,
            type: formType,
            status: formStatus,
            priority: Number(formPriority) || 0,
            starts_at: formStartsAt ? new Date(formStartsAt) : null,
            ends_at: formEndsAt ? new Date(formEndsAt) : null,
            usage_limit: formUsageLimit ? Number(formUsageLimit) : null,
            per_customer_limit: formPerCustomerLimit
                ? Number(formPerCustomerLimit)
                : null,
            is_stackable: formIsStackable,
            is_public: formIsPublic,
            description: formDescription || null,
            conditions: parseJsonSafe(formConditions) ?? null,
            rewards: parseJsonSafe(formRewards) ?? null,
            branch_ids: parseJsonSafe(formBranchIds) ?? null,
            customer_segments: parseJsonSafe(formCustomerSegments) ?? null,
            metadata: parseJsonSafe(formMetadata) ?? null,
        };

        let result;
        if (editingId) {
            result = await updateOffer(editingId, payload);
        } else {
            result = await createOffer(payload);
        }

        setSaving(false);

        if (result.success) {
            setMessage(editingId ? "Offer updated" : "Offer created");
            resetForm();
            setShowForm(false);
            refetch();
        } else {
            setMessage(result.error ?? "Failed to save offer");
        }
    };

    const handleDelete = async (id: string) => {
        const result = await deleteOffer(id);
        if (result.success) {
            setMessage("Offer deleted");
            refetch();
        } else {
            setMessage(result.error ?? "Failed to delete offer");
        }
    };

    const formatType = (type: string) => type.replace(/_/g, " ");

    return (
        <Container className="flex flex-col p-0 overflow-hidden">
            {/* Header */}
            <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Heading>Promotions &amp; Offers</Heading>
                        <Text className="text-ui-fg-subtle">
                            Unified Rules Engine — manage every promotion type from a single
                            interface. Coupons, flash sales, combos, BOGO, cashback,
                            loyalty, referrals, and campaigns are all configured here.
                        </Text>
                    </div>
                    <Button variant="primary" onClick={openCreate}>
                        Create Offer
                    </Button>
                </div>

                {/* Filters */}
                <div className="flex gap-4 items-end">
                    <div className="flex flex-col gap-1 w-48">
                        <Label>Status</Label>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <Select.Trigger>
                                <Select.Value placeholder="All statuses" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="">All statuses</Select.Item>
                                {OFFER_STATUSES.map((s) => (
                                    <Select.Item key={s} value={s}>
                                        {s}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1 w-48">
                        <Label>Type</Label>
                        <Select value={filterType} onValueChange={setFilterType}>
                            <Select.Trigger>
                                <Select.Value placeholder="All types" />
                            </Select.Trigger>
                            <Select.Content>
                                <Select.Item value="">All types</Select.Item>
                                {OFFER_TYPES.map((t) => (
                                    <Select.Item key={t} value={t}>
                                        {formatType(t)}
                                    </Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>
                </div>

                {message && (
                    <Badge
                        color={
                            message.includes("created") ||
                            message.includes("updated") ||
                            message.includes("deleted")
                                ? "green"
                                : "red"
                        }
                        className="w-fit"
                    >
                        {message}
                    </Badge>
                )}
            </div>

            {/* Create/Edit Form */}
            {showForm && (
                <div className="px-6 pb-6 flex flex-col gap-4 border-t border-ui-border-base pt-4">
                    <div className="flex items-center justify-between">
                        <Heading level="h3">
                            {editingId ? "Edit Offer" : "Create Offer"}
                        </Heading>
                        <Button
                            variant="secondary"
                            size="small"
                            onClick={() => {
                                setShowForm(false);
                                resetForm();
                            }}
                        >
                            Cancel
                        </Button>
                    </div>

                    {/* Row 1: Name, Code, Type, Status */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1">
                            <Label>Name *</Label>
                            <Input
                                placeholder="Summer Sale 2026"
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Code</Label>
                            <Input
                                placeholder="SUMMER20"
                                value={formCode}
                                onChange={(e) =>
                                    setFormCode(e.target.value.toUpperCase())
                                }
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Type *</Label>
                            <Select value={formType} onValueChange={setFormType}>
                                <Select.Trigger>
                                    <Select.Value />
                                </Select.Trigger>
                                <Select.Content>
                                    {OFFER_TYPES.map((t) => (
                                        <Select.Item key={t} value={t}>
                                            {formatType(t)}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Status</Label>
                            <Select value={formStatus} onValueChange={setFormStatus}>
                                <Select.Trigger>
                                    <Select.Value />
                                </Select.Trigger>
                                <Select.Content>
                                    {OFFER_STATUSES.map((s) => (
                                        <Select.Item key={s} value={s}>
                                            {s}
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select>
                        </div>
                    </div>

                    {/* Row 2: Priority, Usage, Per-Customer, Switches */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="flex flex-col gap-1">
                            <Label>Priority</Label>
                            <Input
                                type="number"
                                placeholder="0"
                                value={formPriority}
                                onChange={(e) => setFormPriority(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Usage Limit</Label>
                            <Input
                                type="number"
                                placeholder="Unlimited"
                                value={formUsageLimit}
                                onChange={(e) => setFormUsageLimit(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Per Customer Limit</Label>
                            <Input
                                type="number"
                                placeholder="Unlimited"
                                value={formPerCustomerLimit}
                                onChange={(e) => setFormPerCustomerLimit(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-3 pt-5">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formIsStackable}
                                    onCheckedChange={setFormIsStackable}
                                />
                                <Label>Stackable</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={formIsPublic}
                                    onCheckedChange={setFormIsPublic}
                                />
                                <Label>Public</Label>
                            </div>
                        </div>
                    </div>

                    {/* Row 3: Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <Label>Starts At</Label>
                            <Input
                                type="datetime-local"
                                value={formStartsAt}
                                onChange={(e) => setFormStartsAt(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Ends At</Label>
                            <Input
                                type="datetime-local"
                                value={formEndsAt}
                                onChange={(e) => setFormEndsAt(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 4: Description */}
                    <div className="flex flex-col gap-1">
                        <Label>Description</Label>
                        <Textarea
                            placeholder="Internal notes or customer-facing description"
                            value={formDescription}
                            onChange={(e) => setFormDescription(e.target.value)}
                            rows={2}
                        />
                    </div>

                    {/* Row 5: Conditions (JSON) */}
                    <div className="flex flex-col gap-1">
                        <Label>Conditions (JSON)</Label>
                        <Textarea
                            placeholder={`[{"entity":"cart","field":"subtotal","operator":"gte","value":500}]`}
                            value={formConditions}
                            onChange={(e) => setFormConditions(e.target.value)}
                            rows={3}
                        />
                        <Text className="text-ui-fg-subtle text-xs">
                            Array of condition objects. Entities: cart, customer, product,
                            category, branch, order_history, time, payment_method,
                            delivery_type.
                        </Text>
                    </div>

                    {/* Row 6: Rewards (JSON) */}
                    <div className="flex flex-col gap-1">
                        <Label>Rewards (JSON)</Label>
                        <Textarea
                            placeholder={`[{"reward_type":"cart_discount","amount_type":"percent","amount":10,"cap":100}]`}
                            value={formRewards}
                            onChange={(e) => setFormRewards(e.target.value)}
                            rows={3}
                        />
                        <Text className="text-ui-fg-subtle text-xs">
                            Array of reward objects. Types: cart_discount, line_discount,
                            free_item, free_delivery, wallet_cashback, loyalty_points,
                            referral_credit.
                        </Text>
                    </div>

                    {/* Row 7: Restrictions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1">
                            <Label>Branch IDs (JSON)</Label>
                            <Input
                                placeholder='["branch_01", "branch_02"]'
                                value={formBranchIds}
                                onChange={(e) => setFormBranchIds(e.target.value)}
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <Label>Customer Segments (JSON)</Label>
                            <Input
                                placeholder='["vip", "new"]'
                                value={formCustomerSegments}
                                onChange={(e) => setFormCustomerSegments(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 8: Metadata */}
                    <div className="flex flex-col gap-1">
                        <Label>Metadata (JSON)</Label>
                        <Input
                            placeholder='{"campaign_id": "summer2026"}'
                            value={formMetadata}
                            onChange={(e) => setFormMetadata(e.target.value)}
                        />
                    </div>

                    <Button
                        variant="primary"
                        onClick={handleSave}
                        isLoading={saving}
                    >
                        {editingId ? "Update Offer" : "Create Offer"}
                    </Button>
                </div>
            )}

            {/* Offers Table */}
            <div className="px-6 pb-6">
                {loading ? (
                    <Text>Loading...</Text>
                ) : offers.length === 0 ? (
                    <Text className="text-ui-fg-subtle">
                        No offers found. Create one to get started.
                    </Text>
                ) : (
                    <Table>
                        <Table.Header>
                            <Table.Row>
                                <Table.HeaderCell>Name</Table.HeaderCell>
                                <Table.HeaderCell>Code</Table.HeaderCell>
                                <Table.HeaderCell>Type</Table.HeaderCell>
                                <Table.HeaderCell>Status</Table.HeaderCell>
                                <Table.HeaderCell>Priority</Table.HeaderCell>
                                <Table.HeaderCell>Redeemed</Table.HeaderCell>
                                <Table.HeaderCell>Actions</Table.HeaderCell>
                            </Table.Row>
                        </Table.Header>
                        <Table.Body>
                            {offers.map((offer) => (
                                <Table.Row key={offer.id}>
                                    <Table.Cell>
                                        <div className="flex flex-col gap-0.5">
                                            <Text className="font-semibold">
                                                {offer.name}
                                            </Text>
                                            {offer.description && (
                                                <Text className="text-ui-fg-subtle text-xs truncate max-w-[200px]">
                                                    {offer.description}
                                                </Text>
                                            )}
                                        </div>
                                    </Table.Cell>
                                    <Table.Cell>
                                        {offer.code ? (
                                            <Badge>{offer.code}</Badge>
                                        ) : (
                                            <Text className="text-ui-fg-subtle">—</Text>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <Badge color="blue">
                                            {formatType(offer.type)}
                                        </Badge>
                                    </Table.Cell>
                                    <Table.Cell>
                                        <StatusBadge
                                            color={STATUS_COLORS[offer.status] ?? "grey"}
                                        >
                                            {offer.status}
                                        </StatusBadge>
                                    </Table.Cell>
                                    <Table.Cell>{offer.priority}</Table.Cell>
                                    <Table.Cell>
                                        {offer.total_redemptions}
                                        {offer.usage_limit !== null && (
                                            <Text className="text-ui-fg-subtle text-xs">
                                                {" / "}
                                                {offer.usage_limit}
                                            </Text>
                                        )}
                                    </Table.Cell>
                                    <Table.Cell>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                size="small"
                                                onClick={() => openEdit(offer)}
                                            >
                                                Edit
                                            </Button>
                                            <Button
                                                variant="danger"
                                                size="small"
                                                onClick={() => handleDelete(offer.id)}
                                            >
                                                Delete
                                            </Button>
                                        </div>
                                    </Table.Cell>
                                </Table.Row>
                            ))}
                        </Table.Body>
                    </Table>
                )}
            </div>
        </Container>
    );
};

export const config = defineRouteConfig({
    label: "Offers",
    icon: OffersIcon,
});

export default OffersPage;
