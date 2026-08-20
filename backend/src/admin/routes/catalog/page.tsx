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
} from "@medusajs/ui";
import { PackageSearch } from "lucide-react";
import React from "react";
import {
    useProductMeta,
    useReviews,
    useSubscriptions,
    useStockNotifications,
    upsertProductMeta,
    updateProductMeta,
    deleteProductMeta,
    moderateReview,
    deleteReview,
    notifyStockRestocked,
    generateProductDescription,
    generateProductSeoMeta,
    type ProductMetaEntry,
    type ReviewEntry,
    type SubscriptionEntry,
    type StockNotificationEntry,
} from "../../hooks/use-catalog";

const CatalogIcon: React.ForwardRefExoticComponent<
    React.RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props, ref) => (
    <PackageSearch ref={ref} size={16} {...props} />
));

const CatalogPage = () => {
    const [tab, setTab] = useState<"meta" | "reviews" | "subscriptions" | "stock">("meta");

    return (
        <Container className="p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <Heading level="h1">Catalog</Heading>
                <div className="flex gap-2">
                    {(["meta", "reviews", "subscriptions", "stock"] as const).map((t) => (
                        <Button
                            key={t}
                            variant={tab === t ? "secondary" : "transparent"}
                            size="small"
                            onClick={() => setTab(t)}
                        >
                            {t === "meta"
                                ? "Product Meta"
                                : t === "reviews"
                                    ? "Reviews"
                                    : t === "subscriptions"
                                        ? "Subscriptions"
                                        : "Stock Notifications"}
                        </Button>
                    ))}
                </div>
            </div>

            {tab === "meta" && <ProductMetaTab />}
            {tab === "reviews" && <ReviewsTab />}
            {tab === "subscriptions" && <SubscriptionsTab />}
            {tab === "stock" && <StockNotificationsTab />}
        </Container>
    );
};

// ── Product Meta Tab ────────────────────────────────────────────────────────

function ProductMetaTab() {
    const { data, loading } = useProductMeta();
    const [productId, setProductId] = useState("");
    const [form, setForm] = useState<Partial<ProductMetaEntry>>({});
    const [saving, setSaving] = useState(false);
    const [aiDesc, setAiDesc] = useState<string | null>(null);
    const [aiSeo, setAiSeo] = useState<{ meta_title: string; meta_description: string | null } | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const metas = data?.metas ?? [];

    async function handleUpsert() {
        if (!productId) return;
        setSaving(true);
        try {
            await upsertProductMeta({ product_id: productId, ...form });
            setProductId("");
            setForm({});
            window.location.reload();
        } catch (e) {
            console.error(e);
        } finally {
            setSaving(false);
        }
    }

    async function handleGenerateDesc() {
        if (!productId) return;
        setAiLoading(true);
        try {
            const result = await generateProductDescription(productId);
            setAiDesc(result.description);
        } catch (e) {
            console.error(e);
        } finally {
            setAiLoading(false);
        }
    }

    async function handleGenerateSeo() {
        if (!productId) return;
        setAiLoading(true);
        try {
            const result = await generateProductSeoMeta(productId);
            setAiSeo(result);
        } catch (e) {
            console.error(e);
        } finally {
            setAiLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            {/* Upsert form */}
            <div className="border rounded-lg p-4 flex flex-col gap-4">
                <Heading level="h2" className="text-sm font-bold">Upsert Product Meta</Heading>
                <div className="flex flex-col gap-2">
                    <Label>Product ID</Label>
                    <Input
                        value={productId}
                        onChange={(e) => setProductId(e.target.value)}
                        placeholder="prod_..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                        <Label>artisan</Label>
                        <Switch
                            checked={!!form.artisan}
                            onCheckedChange={(v) => setForm({ ...form, artisan: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Sugar-Free</Label>
                        <Switch
                            checked={!!form.sugar_free}
                            onCheckedChange={(v) => setForm({ ...form, sugar_free: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Gluten-Free</Label>
                        <Switch
                            checked={!!form.gluten_free}
                            onCheckedChange={(v) => setForm({ ...form, gluten_free: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Vegan</Label>
                        <Switch
                            checked={!!form.vegan}
                            onCheckedChange={(v) => setForm({ ...form, vegan: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Featured</Label>
                        <Switch
                            checked={!!form.is_featured}
                            onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>Bestseller</Label>
                        <Switch
                            checked={!!form.is_bestseller}
                            onCheckedChange={(v) => setForm({ ...form, is_bestseller: v })}
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <Label>New Arrival</Label>
                        <Switch
                            checked={!!form.is_new_arrival}
                            onCheckedChange={(v) => setForm({ ...form, is_new_arrival: v })}
                        />
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Ingredients</Label>
                    <Textarea
                        value={form.ingredients ?? ""}
                        onChange={(e) => setForm({ ...form, ingredients: e.target.value })}
                        placeholder="Flour, sugar, eggs, butter..."
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Allergens</Label>
                    <Input
                        value={form.allergens ?? ""}
                        onChange={(e) => setForm({ ...form, allergens: e.target.value })}
                        placeholder="Contains gluten, dairy, nuts"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Shelf Life</Label>
                    <Input
                        value={form.shelf_life ?? ""}
                        onChange={(e) => setForm({ ...form, shelf_life: e.target.value })}
                        placeholder="3 days refrigerated"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Storage Instructions</Label>
                    <Input
                        value={form.storage_instructions ?? ""}
                        onChange={(e) => setForm({ ...form, storage_instructions: e.target.value })}
                        placeholder="Keep refrigerated"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>FSSAI License</Label>
                    <Input
                        value={form.fssai_license ?? ""}
                        onChange={(e) => setForm({ ...form, fssai_license: e.target.value })}
                        placeholder="FSSAI-..."
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Label>Video URL</Label>
                    <Input
                        value={form.video_url ?? ""}
                        onChange={(e) => setForm({ ...form, video_url: e.target.value })}
                        placeholder="https://..."
                    />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleUpsert} isLoading={saving}>Save Meta</Button>
                    <Button variant="secondary" onClick={handleGenerateDesc} isLoading={aiLoading}>
                        AI Description
                    </Button>
                    <Button variant="secondary" onClick={handleGenerateSeo} isLoading={aiLoading}>
                        AI SEO Meta
                    </Button>
                </div>
                {aiDesc && (
                    <div className="border rounded p-3 bg-ui-bg-subtle">
                        <Text className="text-xs font-semibold mb-1">AI Generated Description:</Text>
                        <Text className="text-sm">{aiDesc}</Text>
                    </div>
                )}
                {aiSeo && (
                    <div className="border rounded p-3 bg-ui-bg-subtle">
                        <Text className="text-xs font-semibold mb-1">AI SEO Meta:</Text>
                        <Text className="text-sm">Title: {aiSeo.meta_title}</Text>
                        {aiSeo.meta_description && (
                            <Text className="text-sm">Description: {aiSeo.meta_description}</Text>
                        )}
                    </div>
                )}
            </div>

            {/* Existing metas */}
            <div className="flex flex-col gap-2">
                <Heading level="h2" className="text-sm font-bold">Existing Product Meta ({metas.length})</Heading>
                {loading ? (
                    <Text>Loading...</Text>
                ) : metas.length === 0 ? (
                    <Text className="text-ui-fg-subtle">No product meta records yet.</Text>
                ) : (
                    <div className="flex flex-col gap-2">
                        {metas.map((m) => (
                            <div key={m.id} className="border rounded p-3 flex items-center justify-between">
                                <div className="flex flex-col gap-1">
                                    <Text className="text-xs font-mono">{m.product_id}</Text>
                                    <div className="flex gap-1 flex-wrap">
                                        {m.artisan && <Badge size="small" color="green">artisan</Badge>}
                                        {m.sugar_free && <Badge size="small" color="blue">Sugar-Free</Badge>}
                                        {m.gluten_free && <Badge size="small" color="orange">Gluten-Free</Badge>}
                                        {m.vegan && <Badge size="small" color="purple">Vegan</Badge>}
                                        {m.is_bestseller && <Badge size="small" color="red">Bestseller</Badge>}
                                        {m.is_featured && <Badge size="small" color="orange">Featured</Badge>}
                                    </div>
                                </div>
                                <Button
                                    variant="danger"
                                    size="small"
                                    onClick={async () => {
                                        await deleteProductMeta(m.product_id);
                                        window.location.reload();
                                    }}
                                >
                                    Delete
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Reviews Tab ─────────────────────────────────────────────────────────────

function ReviewsTab() {
    const [statusFilter, setStatusFilter] = useState<string>("pending");
    const { data, loading } = useReviews({ status: statusFilter || undefined });

    const reviews = data?.reviews ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Heading level="h2" className="text-sm font-bold">Reviews Moderation</Heading>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v)}
                >
                    <Select.Trigger>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="pending">Pending</Select.Item>
                        <Select.Item value="approved">Approved</Select.Item>
                        <Select.Item value="rejected">Rejected</Select.Item>
                    </Select.Content>
                </Select>
            </div>

            {loading ? (
                <Text>Loading...</Text>
            ) : reviews.length === 0 ? (
                <Text className="text-ui-fg-subtle">No reviews found.</Text>
            ) : (
                <div className="flex flex-col gap-3">
                    {reviews.map((r) => (
                        <div key={r.id} className="border rounded-lg p-4 flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Text className="font-semibold text-sm">
                                        {r.customer_name ?? "Anonymous"}
                                    </Text>
                                    <StatusBadge color={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"}>
                                        {r.status}
                                    </StatusBadge>
                                    {r.verified_purchase && (
                                        <Badge size="small" color="green">Verified</Badge>
                                    )}
                                </div>
                                <Text className="text-sm">⭐ {r.rating}/5</Text>
                            </div>
                            <Text className="text-xs text-ui-fg-subtle">Product: {r.product_id}</Text>
                            {r.title && <Text className="font-medium text-sm">{r.title}</Text>}
                            {r.body && <Text className="text-sm">{r.body}</Text>}
                            {r.reply && (
                                <div className="ml-4 border-l-2 pl-3 text-sm bg-ui-bg-subtle rounded p-2">
                                    <Text className="font-semibold text-xs">Reply:</Text>
                                    <Text>{r.reply}</Text>
                                </div>
                            )}
                            <div className="flex gap-2 mt-2">
                                {r.status === "pending" && (
                                    <>
                                        <Button
                                            size="small"
                                            onClick={async () => {
                                                await moderateReview(r.id, { status: "approved" });
                                                window.location.reload();
                                            }}
                                        >
                                            Approve
                                        </Button>
                                        <Button
                                            size="small"
                                            variant="danger"
                                            onClick={async () => {
                                                await moderateReview(r.id, { status: "rejected" });
                                                window.location.reload();
                                            }}
                                        >
                                            Reject
                                        </Button>
                                    </>
                                )}
                                <Button
                                    size="small"
                                    variant="transparent"
                                    onClick={async () => {
                                        await deleteReview(r.id);
                                        window.location.reload();
                                    }}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Subscriptions Tab ───────────────────────────────────────────────────────

function SubscriptionsTab() {
    const [statusFilter, setStatusFilter] = useState<string>("");
    const { data, loading } = useSubscriptions({ status: statusFilter || undefined });

    const subscriptions = data?.subscriptions ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Heading level="h2" className="text-sm font-bold">Subscriptions</Heading>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v)}
                >
                    <Select.Trigger>
                        <Select.Value placeholder="All statuses" />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="">All</Select.Item>
                        <Select.Item value="active">Active</Select.Item>
                        <Select.Item value="paused">Paused</Select.Item>
                        <Select.Item value="cancelled">Cancelled</Select.Item>
                        <Select.Item value="expired">Expired</Select.Item>
                    </Select.Content>
                </Select>
            </div>

            {loading ? (
                <Text>Loading...</Text>
            ) : subscriptions.length === 0 ? (
                <Text className="text-ui-fg-subtle">No subscriptions found.</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {subscriptions.map((s) => (
                        <div key={s.id} className="border rounded p-3 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <Text className="text-xs font-mono">{s.id}</Text>
                                <Text className="text-sm">
                                    Customer: {s.customer_id} | Product: {s.product_id}
                                </Text>
                                <Text className="text-xs text-ui-fg-subtle">
                                    {s.frequency} | Next: {new Date(s.next_date).toLocaleDateString()} | Deliveries: {s.deliveries_count}
                                    {s.max_deliveries ? `/${s.max_deliveries}` : ""}
                                </Text>
                            </div>
                            <StatusBadge
                                color={
                                    s.status === "active"
                                        ? "green"
                                        : s.status === "paused"
                                            ? "orange"
                                            : s.status === "cancelled"
                                                ? "red"
                                                : "grey"
                                }
                            >
                                {s.status}
                            </StatusBadge>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Stock Notifications Tab ─────────────────────────────────────────────────

function StockNotificationsTab() {
    const [statusFilter, setStatusFilter] = useState<string>("pending");
    const { data, loading } = useStockNotifications({ status: statusFilter || undefined });

    const notifications = data?.notifications ?? [];

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
                <Heading level="h2" className="text-sm font-bold">Stock Notifications</Heading>
                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v)}
                >
                    <Select.Trigger>
                        <Select.Value />
                    </Select.Trigger>
                    <Select.Content>
                        <Select.Item value="pending">Pending</Select.Item>
                        <Select.Item value="notified">Notified</Select.Item>
                    </Select.Content>
                </Select>
            </div>

            {loading ? (
                <Text>Loading...</Text>
            ) : notifications.length === 0 ? (
                <Text className="text-ui-fg-subtle">No stock notifications found.</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {notifications.map((n) => (
                        <div key={n.id} className="border rounded p-3 flex items-center justify-between">
                            <div className="flex flex-col gap-1">
                                <Text className="text-xs font-mono">Product: {n.product_id}</Text>
                                <Text className="text-sm">
                                    {n.email ? `Email: ${n.email}` : ""}
                                    {n.phone ? `Phone: ${n.phone}` : ""}
                                    {n.customer_id ? `Customer: ${n.customer_id}` : "Guest"}
                                </Text>
                            </div>
                            <div className="flex items-center gap-2">
                                <StatusBadge color={n.status === "notified" ? "green" : "orange"}>
                                    {n.status}
                                </StatusBadge>
                                {n.status === "pending" && (
                                    <Button
                                        size="small"
                                        onClick={async () => {
                                            await notifyStockRestocked(n.product_id);
                                            window.location.reload();
                                        }}
                                    >
                                        Mark Notified
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export const config = defineRouteConfig({
    label: "Catalog",
    icon: CatalogIcon,
});

export default CatalogPage;
