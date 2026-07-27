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
    Table,
    Checkbox,
} from "@medusajs/ui";
import { Wrench } from "lucide-react";
import React from "react";
import {
    useOffers,
    usePopups,
    useGamificationRewards,
    useQRCodes,
    useNewsletterSubscribers,
    useRecoveryJobs,
    createOffer,
    updateOffer,
    deleteOffer,
    createTypedOffer,
    bulkGenerateCoupons,
    createPopup,
    updatePopup,
    deletePopup,
    createQRCode,
    deleteQRCode,
    markRecoveryJobSent,
    markRecoveryJobRecovered,
    cancelRecoveryJob,
    type OfferDTO,
    type PopupDTO,
    type GamificationRewardDTO,
    type QRCodeDTO,
    type NewsletterSubscriberDTO,
    type RecoveryJobDTO,
} from "../../hooks/use-marketing";

const ToolkitIcon: React.ForwardRefExoticComponent<
    React.RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props, ref) => (
    <Wrench ref={ref} size={16} {...props} />
));

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
];

const OFFER_STATUSES = ["draft", "active", "scheduled", "expired", "disabled"];

const STATUS_COLORS: Record<string, "grey" | "green" | "orange" | "red" | "blue" | "purple"> = {
    draft: "grey",
    active: "green",
    scheduled: "blue",
    expired: "orange",
    disabled: "red",
    subscribed: "green",
    unsubscribed: "grey",
    bounced: "red",
    pending: "grey",
    sent: "blue",
    recovered: "green",
    expired_stage: "orange",
    cancelled: "red",
    win: "green",
    lose: "grey",
    retry: "orange",
};

const MarketingToolkitAdminPage = () => {
    const [activeTab, setActiveTab] = useState<
        | "offers"
        | "create_offer"
        | "bulk_coupons"
        | "popups"
        | "gamification"
        | "qr"
        | "newsletter"
        | "recovery"
    >("offers");

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ui-border-base pb-4">
                <div>
                    <Heading level="h1">Marketing Toolkit & Promotions</Heading>
                    <Text className="text-ui-fg-subtle text-sm">
                        Coupon/Discount engine, popups, gamification, QR codes, newsletter, and recovery jobs.
                        All promotions flow through the M2 Rules Engine — no duplicate promotion logic.
                    </Text>
                </div>
            </div>

            <div className="flex border-b border-ui-border-base gap-2 overflow-x-auto pb-1">
                {[
                    { id: "offers", label: "Offers / Coupons" },
                    { id: "create_offer", label: "Create Offer" },
                    { id: "bulk_coupons", label: "Bulk Coupons" },
                    { id: "popups", label: "Popups" },
                    { id: "gamification", label: "Gamification" },
                    { id: "qr", label: "QR Codes" },
                    { id: "newsletter", label: "Newsletter" },
                    { id: "recovery", label: "Recovery" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${
                            activeTab === tab.id
                                ? "border-ui-border-interactive text-ui-fg-interactive bg-ui-bg-subtle-hover"
                                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="w-full">
                {activeTab === "offers" && <OffersPanel />}
                {activeTab === "create_offer" && <CreateOfferPanel />}
                {activeTab === "bulk_coupons" && <BulkCouponsPanel />}
                {activeTab === "popups" && <PopupsPanel />}
                {activeTab === "gamification" && <GamificationPanel />}
                {activeTab === "qr" && <QRPanel />}
                {activeTab === "newsletter" && <NewsletterPanel />}
                {activeTab === "recovery" && <RecoveryPanel />}
            </div>
        </div>
    );
};

// ── Offers Panel ──────────────────────────────────────────────────────────────

function OffersPanel() {
    const [statusFilter, setStatusFilter] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const { data, loading, refetch } = useOffers({
        status: statusFilter || undefined,
        type: typeFilter || undefined,
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center flex-wrap">
                <div className="w-48">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
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
                <div className="w-56">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <Select.Trigger>
                            <Select.Value placeholder="All types" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All types</Select.Item>
                            {OFFER_TYPES.map((t) => (
                                <Select.Item key={t} value={t}>
                                    {t}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>
                <Button variant="secondary" size="small" onClick={refetch}>
                    Refresh
                </Button>
            </div>

            {loading ? (
                <Text>Loading offers…</Text>
            ) : data && data.offers.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Code</Table.HeaderCell>
                            <Table.HeaderCell>Type</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Priority</Table.HeaderCell>
                            <Table.HeaderCell>Redemptions</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.offers.map((o: OfferDTO) => (
                            <Table.Row key={o.id}>
                                <Table.Cell>{o.name}</Table.Cell>
                                <Table.Cell>{o.code ?? "—"}</Table.Cell>
                                <Table.Cell>{o.type}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[o.status] ?? "grey"}>
                                        {o.status}
                                    </Badge>
                                </Table.Cell>
                                <Table.Cell>{o.priority}</Table.Cell>
                                <Table.Cell>{o.total_redemptions}</Table.Cell>
                                <Table.Cell>
                                    <Button
                                        size="small"
                                        variant="danger"
                                        onClick={async () => {
                                            await deleteOffer(o.id);
                                            refetch();
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No offers found. Create one from the "Create Offer" tab.</Text>
            )}
        </div>
    );
}

// ── Create Offer Panel (typed factory) ────────────────────────────────────────

function CreateOfferPanel() {
    const [factoryType, setFactoryType] = useState("flash_sale");
    const [form, setForm] = useState<any>({
        name: "",
        product_ids: "",
        discount_percent: "10",
        starts_at: "",
        ends_at: "",
        buy_product_id: "",
        buy_quantity: "1",
        get_product_id: "",
        get_quantity: "1",
        get_discount_percent: "100",
        required_product_ids: "",
        free_product_id: "",
        min_subtotal: "",
        discount_fixed: "",
        code: "",
        usage_limit: "",
        per_customer_limit: "",
        branch_ids: "",
        description: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            setError("Name is required.");
            return;
        }
        setSaving(true);
        setError(null);
        setResult(null);
        try {
            const payload: any = { offer_type: factoryType, name: form.name };
            if (form.code) payload.code = form.code;
            if (form.starts_at) payload.starts_at = form.starts_at;
            if (form.ends_at) payload.ends_at = form.ends_at;
            if (form.usage_limit) payload.usage_limit = Number(form.usage_limit);
            if (form.per_customer_limit)
                payload.per_customer_limit = Number(form.per_customer_limit);
            if (form.branch_ids)
                payload.branch_ids = form.branch_ids.split(",").map((s: string) => s.trim());
            if (form.description) payload.description = form.description;

            switch (factoryType) {
                case "flash_sale":
                    payload.product_ids = form.product_ids.split(",").map((s: string) => s.trim());
                    payload.discount_percent = Number(form.discount_percent);
                    payload.starts_at = form.starts_at || payload.starts_at;
                    payload.ends_at = form.ends_at || payload.ends_at;
                    break;
                case "combo_discount":
                    payload.product_ids = form.product_ids.split(",").map((s: string) => s.trim());
                    if (form.discount_percent) payload.discount_percent = Number(form.discount_percent);
                    if (form.discount_fixed) payload.discount_fixed = Number(form.discount_fixed);
                    break;
                case "combo_offer":
                    payload.required_product_ids = form.required_product_ids
                        .split(",")
                        .map((s: string) => s.trim());
                    payload.free_product_id = form.free_product_id;
                    if (form.get_quantity) payload.free_quantity = Number(form.get_quantity);
                    break;
                case "free_delivery":
                    if (form.min_subtotal) payload.min_subtotal = Number(form.min_subtotal);
                    break;
                case "buy_x_get_y":
                    payload.buy_product_id = form.buy_product_id;
                    payload.buy_quantity = Number(form.buy_quantity);
                    payload.get_product_id = form.get_product_id;
                    payload.get_quantity = Number(form.get_quantity);
                    payload.get_discount_percent = Number(form.get_discount_percent);
                    break;
            }
            const res = await createTypedOffer(payload);
            if (res.message) throw new Error(res.message);
            setResult(res.offer);
        } catch (e: any) {
            setError(e.message ?? "Failed to create offer.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Container className="flex flex-col gap-4 p-6">
            <Heading level="h3">Create Typed Offer</Heading>
            <Text className="text-ui-fg-subtle text-sm">
                Builds the canonical condition/reward JSON for each promotion type and
                persists a standard M2 Offer row.
            </Text>

            <div className="w-64">
                <Label>Offer type</Label>
                <Select value={factoryType} onValueChange={setFactoryType}>
                    <Select.Trigger>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="flash_sale">Flash Sale</Select.Item>
                        <Select.Item value="combo_discount">Combo Discount</Select.Item>
                        <Select.Item value="combo_offer">Combo Offer (free gift)</Select.Item>
                        <Select.Item value="free_delivery">Free Delivery</Select.Item>
                        <Select.Item value="buy_x_get_y">Buy X Get Y (BOGO)</Select.Item>
                    </Select.Content>
                </Select>
            </div>

            <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <Field label="Code (optional)" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <Field label="Starts at (ISO)" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} />
            <Field label="Ends at (ISO)" value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} />
            <Field label="Usage limit" value={form.usage_limit} onChange={(v) => setForm({ ...form, usage_limit: v })} />
            <Field label="Per-customer limit" value={form.per_customer_limit} onChange={(v) => setForm({ ...form, per_customer_limit: v })} />
            <Field label="Branch IDs (comma-separated)" value={form.branch_ids} onChange={(v) => setForm({ ...form, branch_ids: v })} />
            <Field label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />

            {(factoryType === "flash_sale" || factoryType === "combo_discount") && (
                <>
                    <Field label="Product IDs (comma-separated)" value={form.product_ids} onChange={(v) => setForm({ ...form, product_ids: v })} />
                    {factoryType === "flash_sale" && (
                        <Field label="Discount %" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: v })} />
                    )}
                    {factoryType === "combo_discount" && (
                        <>
                            <Field label="Discount % (optional)" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: v })} />
                            <Field label="Discount fixed (optional)" value={form.discount_fixed} onChange={(v) => setForm({ ...form, discount_fixed: v })} />
                        </>
                    )}
                </>
            )}

            {factoryType === "combo_offer" && (
                <>
                    <Field label="Required product IDs (comma-separated, ≥2)" value={form.required_product_ids} onChange={(v) => setForm({ ...form, required_product_ids: v })} />
                    <Field label="Free product ID" value={form.free_product_id} onChange={(v) => setForm({ ...form, free_product_id: v })} />
                    <Field label="Free quantity" value={form.get_quantity} onChange={(v) => setForm({ ...form, get_quantity: v })} />
                </>
            )}

            {factoryType === "free_delivery" && (
                <Field label="Min subtotal (optional)" value={form.min_subtotal} onChange={(v) => setForm({ ...form, min_subtotal: v })} />
            )}

            {factoryType === "buy_x_get_y" && (
                <>
                    <Field label="Buy product ID" value={form.buy_product_id} onChange={(v) => setForm({ ...form, buy_product_id: v })} />
                    <Field label="Buy quantity" value={form.buy_quantity} onChange={(v) => setForm({ ...form, buy_quantity: v })} />
                    <Field label="Get product ID" value={form.get_product_id} onChange={(v) => setForm({ ...form, get_product_id: v })} />
                    <Field label="Get quantity" value={form.get_quantity} onChange={(v) => setForm({ ...form, get_quantity: v })} />
                    <Field label="Get discount % (100 = free)" value={form.get_discount_percent} onChange={(v) => setForm({ ...form, get_discount_percent: v })} />
                </>
            )}

            {error && <Text className="text-ui-fg-error">{error}</Text>}
            {result && (
                <Container className="p-3 bg-ui-bg-subtle">
                    <Text className="text-ui-fg-success">Created offer: {result.id} ({result.type})</Text>
                </Container>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Creating…" : "Create Offer"}
            </Button>
        </Container>
    );
}

// ── Bulk Coupons Panel ────────────────────────────────────────────────────────

function BulkCouponsPanel() {
    const [form, setForm] = useState({
        count: "100",
        prefix: "CAKE",
        name_prefix: "Diwali Coupon",
        type: "coupon",
        discount_percent: "10",
        code_length: "8",
        usage_limit: "1",
        per_customer_limit: "1",
        starts_at: "",
        ends_at: "",
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<any>(null);

    const handleSubmit = async () => {
        setSaving(true);
        setError(null);
        setResult(null);
        try {
            const payload: any = {
                count: Number(form.count),
                prefix: form.prefix,
                name_prefix: form.name_prefix,
                type: form.type,
                discount_percent: form.discount_percent
                    ? Number(form.discount_percent)
                    : undefined,
                code_length: Number(form.code_length),
                usage_limit: Number(form.usage_limit),
                per_customer_limit: Number(form.per_customer_limit),
                starts_at: form.starts_at || undefined,
                ends_at: form.ends_at || undefined,
            };
            const res = await bulkGenerateCoupons(payload);
            if (res.message) throw new Error(res.message);
            setResult(res);
        } catch (e: any) {
            setError(e.message ?? "Failed to generate coupons.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Container className="flex flex-col gap-4 p-6">
            <Heading level="h3">Bulk Generate Coupons</Heading>
            <Text className="text-ui-fg-subtle text-sm">
                Generates N unique coupon codes, each backed by a distinct M2 Offer row.
            </Text>
            <Field label="Count (1..10000)" value={form.count} onChange={(v) => setForm({ ...form, count: v })} />
            <Field label="Prefix" value={form.prefix} onChange={(v) => setForm({ ...form, prefix: v })} />
            <Field label="Name prefix" value={form.name_prefix} onChange={(v) => setForm({ ...form, name_prefix: v })} />
            <div className="w-64">
                <Label>Type</Label>
                <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v })}
                >
                    <Select.Trigger>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="coupon">coupon</Select.Item>
                        <Select.Item value="promo_code">promo_code</Select.Item>
                    </Select.Content>
                </Select>
            </div>
            <Field label="Discount %" value={form.discount_percent} onChange={(v) => setForm({ ...form, discount_percent: v })} />
            <Field label="Code length" value={form.code_length} onChange={(v) => setForm({ ...form, code_length: v })} />
            <Field label="Usage limit" value={form.usage_limit} onChange={(v) => setForm({ ...form, usage_limit: v })} />
            <Field label="Per-customer limit" value={form.per_customer_limit} onChange={(v) => setForm({ ...form, per_customer_limit: v })} />
            <Field label="Starts at (ISO)" value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} />
            <Field label="Ends at (ISO)" value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} />
            {error && <Text className="text-ui-fg-error">{error}</Text>}
            {result && (
                <Container className="p-3 bg-ui-bg-subtle">
                    <Text className="text-ui-fg-success">
                        Generated {result.count} coupons. First code: {result.offers?.[0]?.code}
                    </Text>
                </Container>
            )}
            <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "Generating…" : "Generate Coupons"}
            </Button>
        </Container>
    );
}

// ── Popups Panel ──────────────────────────────────────────────────────────────

function PopupsPanel() {
    const { data, loading, refetch } = usePopups();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: "",
        trigger: "exit_intent",
        headline: "",
        body: "",
        cta_label: "Shop Now",
        cta_url: "/campaigns",
        offer_code: "",
        status: "draft",
    });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        setSaving(true);
        try {
            await createPopup({
                name: form.name,
                trigger: form.trigger,
                headline: form.headline || null,
                body: form.body || null,
                cta_label: form.cta_label || null,
                cta_url: form.cta_url || null,
                offer_code: form.offer_code || null,
                status: form.status,
            });
            setForm({ name: "", trigger: "exit_intent", headline: "", body: "", cta_label: "Shop Now", cta_url: "/campaigns", offer_code: "", status: "draft" });
            setShowCreate(false);
            refetch();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Heading level="h3">Exit-Intent / Marketing Popups</Heading>
                <Button size="small" variant="secondary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? "Cancel" : "Create Popup"}
                </Button>
            </div>

            {showCreate && (
                <Container className="flex flex-col gap-3 p-4">
                    <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <div className="w-48">
                        <Label>Trigger</Label>
                        <Select value={form.trigger} onValueChange={(v) => setForm({ ...form, trigger: v })}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                                <Select.Item value="exit_intent">exit_intent</Select.Item>
                                <Select.Item value="entry">entry</Select.Item>
                                <Select.Item value="scroll">scroll</Select.Item>
                                <Select.Item value="time_delay">time_delay</Select.Item>
                                <Select.Item value="manual">manual</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>
                    <Field label="Headline" value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} />
                    <div className="flex flex-col gap-1">
                        <Label>Body</Label>
                        <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
                    </div>
                    <Field label="CTA label" value={form.cta_label} onChange={(v) => setForm({ ...form, cta_label: v })} />
                    <Field label="CTA URL" value={form.cta_url} onChange={(v) => setForm({ ...form, cta_url: v })} />
                    <Field label="Offer code (optional)" value={form.offer_code} onChange={(v) => setForm({ ...form, offer_code: v })} />
                    <Button size="small" onClick={handleCreate} disabled={saving || !form.name}>
                        {saving ? "Saving…" : "Save Popup"}
                    </Button>
                </Container>
            )}

            {loading ? (
                <Text>Loading popups…</Text>
            ) : data && data.popups.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Trigger</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>CTA</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.popups.map((p: PopupDTO) => (
                            <Table.Row key={p.id}>
                                <Table.Cell>{p.name}</Table.Cell>
                                <Table.Cell>{p.trigger}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[p.status] ?? "grey"}>{p.status}</Badge>
                                </Table.Cell>
                                <Table.Cell>{p.cta_label ?? "—"}</Table.Cell>
                                <Table.Cell>
                                    <div className="flex gap-1">
                                        <Button
                                            size="small"
                                            variant="secondary"
                                            onClick={async () => {
                                                await updatePopup(p.id, {
                                                    status: p.status === "active" ? "paused" : "active",
                                                });
                                                refetch();
                                            }}
                                        >
                                            {p.status === "active" ? "Pause" : "Activate"}
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="danger"
                                            onClick={async () => {
                                                await deletePopup(p.id);
                                                refetch();
                                            }}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No popups. Create one to show exit-intent offers on the storefront.</Text>
            )}
        </div>
    );
}

// ── Gamification Panel ────────────────────────────────────────────────────────

function GamificationPanel() {
    const [widgetFilter, setWidgetFilter] = useState("");
    const { data, loading, refetch } = useGamificationRewards({
        widget_type: widgetFilter || undefined,
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center">
                <div className="w-56">
                    <Select value={widgetFilter} onValueChange={setWidgetFilter}>
                        <Select.Trigger><Select.Value placeholder="All widgets" /></Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All widgets</Select.Item>
                            <Select.Item value="spin_wheel">spin_wheel</Select.Item>
                            <Select.Item value="scratch_card">scratch_card</Select.Item>
                            <Select.Item value="lucky_draw">lucky_draw</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <Button variant="secondary" size="small" onClick={refetch}>Refresh</Button>
            </div>
            {loading ? (
                <Text>Loading gamification rewards…</Text>
            ) : data && data.rewards.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Widget</Table.HeaderCell>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Outcome</Table.HeaderCell>
                            <Table.HeaderCell>Reward</Table.HeaderCell>
                            <Table.HeaderCell>Code</Table.HeaderCell>
                            <Table.HeaderCell>Redeemed</Table.HeaderCell>
                            <Table.HeaderCell>Customer</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.rewards.map((r: GamificationRewardDTO) => (
                            <Table.Row key={r.id}>
                                <Table.Cell>{r.widget_type}</Table.Cell>
                                <Table.Cell>{r.name}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[r.outcome] ?? "grey"}>{r.outcome}</Badge>
                                </Table.Cell>
                                <Table.Cell>{r.reward_label ?? "—"}</Table.Cell>
                                <Table.Cell>{r.coupon_code ?? "—"}</Table.Cell>
                                <Table.Cell>{r.redeemed ? "✓" : "—"}</Table.Cell>
                                <Table.Cell>{r.customer_id ?? r.session_id ?? "guest"}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No gamification rewards recorded yet.</Text>
            )}
        </div>
    );
}

// ── QR Codes Panel ────────────────────────────────────────────────────────────

function QRPanel() {
    const { data, loading, refetch } = useQRCodes();
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({
        name: "",
        target_type: "url",
        target_id: "",
        offer_code: "",
        campaign_id: "",
    });
    const [saving, setSaving] = useState(false);
    const [created, setCreated] = useState<any>(null);

    const handleCreate = async () => {
        setSaving(true);
        setCreated(null);
        try {
            const res = await createQRCode({
                name: form.name,
                target_type: form.target_type,
                target_id: form.target_id || null,
                offer_code: form.offer_code || null,
                campaign_id: form.campaign_id || null,
            });
            setCreated(res.qr_code);
            setForm({ name: "", target_type: "url", target_id: "", offer_code: "", campaign_id: "" });
            setShowCreate(false);
            refetch();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Heading level="h3">QR Code Promotions</Heading>
                <Button size="small" variant="secondary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? "Cancel" : "Create QR Code"}
                </Button>
            </div>
            {showCreate && (
                <Container className="flex flex-col gap-3 p-4">
                    <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <div className="w-48">
                        <Label>Target type</Label>
                        <Select value={form.target_type} onValueChange={(v) => setForm({ ...form, target_type: v })}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                                <Select.Item value="url">url</Select.Item>
                                <Select.Item value="campaign">campaign</Select.Item>
                                <Select.Item value="offer">offer</Select.Item>
                                <Select.Item value="landing_page">landing_page</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>
                    <Field label="Target ID (URL / campaign id / offer id / slug)" value={form.target_id} onChange={(v) => setForm({ ...form, target_id: v })} />
                    <Field label="Offer code (optional)" value={form.offer_code} onChange={(v) => setForm({ ...form, offer_code: v })} />
                    <Field label="Campaign ID (optional)" value={form.campaign_id} onChange={(v) => setForm({ ...form, campaign_id: v })} />
                    <Button size="small" onClick={handleCreate} disabled={saving || !form.name}>
                        {saving ? "Saving…" : "Save QR Code"}
                    </Button>
                </Container>
            )}
            {created && (
                <Container className="p-3 bg-ui-bg-subtle">
                    <Text className="text-ui-fg-success">
                        Created QR code: {created.code} → resolves to {created.target_type}
                    </Text>
                </Container>
            )}
            {loading ? (
                <Text>Loading QR codes…</Text>
            ) : data && data.qr_codes.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Code</Table.HeaderCell>
                            <Table.HeaderCell>Target</Table.HeaderCell>
                            <Table.HeaderCell>Scans</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.qr_codes.map((q: QRCodeDTO) => (
                            <Table.Row key={q.id}>
                                <Table.Cell>{q.name}</Table.Cell>
                                <Table.Cell className="font-mono">{q.code}</Table.Cell>
                                <Table.Cell>{q.target_type}: {q.target_id ?? "—"}</Table.Cell>
                                <Table.Cell>{q.scan_count}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={q.status === "active" ? "green" : "grey"}>{q.status}</Badge>
                                </Table.Cell>
                                <Table.Cell>
                                    <Button
                                        size="small"
                                        variant="danger"
                                        onClick={async () => {
                                            await deleteQRCode(q.id);
                                            refetch();
                                        }}
                                    >
                                        Delete
                                    </Button>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No QR codes. Create one to track offline-to-online promotions.</Text>
            )}
        </div>
    );
}

// ── Newsletter Panel ──────────────────────────────────────────────────────────

function NewsletterPanel() {
    const { data, loading, refetch } = useNewsletterSubscribers();
    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Heading level="h3">Newsletter Subscribers</Heading>
                <Button size="small" variant="secondary" onClick={refetch}>Refresh</Button>
            </div>
            {loading ? (
                <Text>Loading subscribers…</Text>
            ) : data && data.subscribers.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Email</Table.HeaderCell>
                            <Table.HeaderCell>Phone</Table.HeaderCell>
                            <Table.HeaderCell>Source</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Subscribed at</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.subscribers.map((s: NewsletterSubscriberDTO) => (
                            <Table.Row key={s.id}>
                                <Table.Cell>{s.email}</Table.Cell>
                                <Table.Cell>{s.phone ?? "—"}</Table.Cell>
                                <Table.Cell>{s.source}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[s.status] ?? "grey"}>{s.status}</Badge>
                                </Table.Cell>
                                <Table.Cell>{new Date(s.created_at).toLocaleDateString()}</Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No subscribers yet. The storefront footer subscribe form feeds this table.</Text>
            )}
        </div>
    );
}

// ── Recovery Panel ────────────────────────────────────────────────────────────

function RecoveryPanel() {
    const [typeFilter, setTypeFilter] = useState("");
    const [stageFilter, setStageFilter] = useState("");
    const { data, loading, refetch } = useRecoveryJobs({
        type: typeFilter || undefined,
        stage: stageFilter || undefined,
    });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center flex-wrap">
                <div className="w-48">
                    <Select value={typeFilter} onValueChange={setTypeFilter}>
                        <Select.Trigger><Select.Value placeholder="All types" /></Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All types</Select.Item>
                            <Select.Item value="abandoned_cart">abandoned_cart</Select.Item>
                            <Select.Item value="wishlist">wishlist</Select.Item>
                            <Select.Item value="recently_viewed">recently_viewed</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <div className="w-48">
                    <Select value={stageFilter} onValueChange={setStageFilter}>
                        <Select.Trigger><Select.Value placeholder="All stages" /></Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All stages</Select.Item>
                            <Select.Item value="pending">pending</Select.Item>
                            <Select.Item value="sent">sent</Select.Item>
                            <Select.Item value="recovered">recovered</Select.Item>
                            <Select.Item value="expired">expired</Select.Item>
                            <Select.Item value="cancelled">cancelled</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <Button variant="secondary" size="small" onClick={refetch}>Refresh</Button>
            </div>
            {loading ? (
                <Text>Loading recovery jobs…</Text>
            ) : data && data.jobs.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Type</Table.HeaderCell>
                            <Table.HeaderCell>Stage</Table.HeaderCell>
                            <Table.HeaderCell>Email</Table.HeaderCell>
                            <Table.HeaderCell>Cart</Table.HeaderCell>
                            <Table.HeaderCell>Scheduled</Table.HeaderCell>
                            <Table.HeaderCell>Attempts</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.jobs.map((j: RecoveryJobDTO) => (
                            <Table.Row key={j.id}>
                                <Table.Cell>{j.type}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[j.stage] ?? "grey"}>{j.stage}</Badge>
                                </Table.Cell>
                                <Table.Cell>{j.email ?? "—"}</Table.Cell>
                                <Table.Cell className="font-mono text-xs">{j.cart_id ?? "—"}</Table.Cell>
                                <Table.Cell>
                                    {j.scheduled_at ? new Date(j.scheduled_at).toLocaleString() : "—"}
                                </Table.Cell>
                                <Table.Cell>{j.attempts}</Table.Cell>
                                <Table.Cell>
                                    <div className="flex gap-1">
                                        {j.stage === "pending" && (
                                            <Button
                                                size="small"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await markRecoveryJobSent(j.id);
                                                    refetch();
                                                }}
                                            >
                                                Mark Sent
                                            </Button>
                                        )}
                                        {j.stage !== "recovered" && j.stage !== "cancelled" && (
                                            <>
                                                <Button
                                                    size="small"
                                                    variant="secondary"
                                                    onClick={async () => {
                                                        await markRecoveryJobRecovered(j.id);
                                                        refetch();
                                                    }}
                                                >
                                                    Recovered
                                                </Button>
                                                <Button
                                                    size="small"
                                                    variant="danger"
                                                    onClick={async () => {
                                                        await cancelRecoveryJob(j.id);
                                                        refetch();
                                                    }}
                                                >
                                                    Cancel
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No recovery jobs. Abandoned-cart recovery jobs are created automatically by the storefront.</Text>
            )}
        </div>
    );
}

// ── Reusable field ────────────────────────────────────────────────────────────

function Field({
    label,
    value,
    onChange,
}: {
    label: string;
    value: string;
    onChange: (v: string) => void;
}) {
    return (
        <div className="flex flex-col gap-1 w-full max-w-md">
            <Label>{label}</Label>
            <Input value={value} onChange={(e) => onChange(e.target.value)} />
        </div>
    );
}

export const config = defineRouteConfig({
    label: "Toolkit",
    icon: ToolkitIcon,
});

export default MarketingToolkitAdminPage;
