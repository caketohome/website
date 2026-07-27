import { defineRouteConfig } from "@medusajs/admin-sdk";
import { useState, useEffect } from "react";
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
import { Megaphone } from "lucide-react";
import React from "react";
import {
    useMarketingOverview,
    useCampaigns,
    useCampaign,
    useCampaignEvents,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    transitionCampaign,
    type CampaignDTO,
} from "../../hooks/use-marketing";

const MarketingIcon: React.ForwardRefExoticComponent<
    React.RefAttributes<SVGSVGElement>
> = React.forwardRef<SVGSVGElement>((props, ref) => (
    <Megaphone ref={ref} size={16} {...props} />
));

const STATUS_COLORS: Record<string, "grey" | "green" | "orange" | "red" | "blue" | "purple"> = {
    draft: "grey",
    active: "green",
    paused: "orange",
    completed: "blue",
    cancelled: "red",
    archived: "purple",
};

const CAMPAIGN_TYPES = [
    "promotion", "seasonal", "flash_sale", "retention", "acquisition",
    "winback", "brand", "loyalty", "referral", "birthday", "anniversary", "festival",
];

const GOAL_TYPES = ["revenue", "orders", "conversions", "clicks", "reach", "retention"];

const MarketingAdminPage = () => {
    const [activeTab, setActiveTab] = useState<"overview" | "campaigns" | "create" | "detail">("overview");
    const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>("");

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-ui-border-base pb-4">
                <div>
                    <Heading level="h1">Marketing & Campaigns</Heading>
                    <Text className="text-ui-fg-subtle text-sm">
                        Plan, schedule, target, and track marketing campaigns with budget & goal controls.
                    </Text>
                </div>
            </div>

            <div className="flex border-b border-ui-border-base gap-2 overflow-x-auto pb-1">
                {[
                    { id: "overview", label: "Overview" },
                    { id: "campaigns", label: "Campaigns" },
                    { id: "create", label: "Create Campaign" },
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${activeTab === tab.id
                                ? "border-ui-border-interactive text-ui-fg-interactive bg-ui-bg-subtle-hover"
                                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
                {selectedCampaignId && (
                    <button
                        onClick={() => setActiveTab("detail")}
                        className={`px-4 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-all ${activeTab === "detail"
                                ? "border-ui-border-interactive text-ui-fg-interactive bg-ui-bg-subtle-hover"
                                : "border-transparent text-ui-fg-subtle hover:text-ui-fg-base"
                            }`}
                    >
                        Campaign Detail
                    </button>
                )}
            </div>

            <div className="w-full">
                {activeTab === "overview" && <OverviewPanel />}
                {activeTab === "campaigns" && (
                    <CampaignsPanel
                        statusFilter={statusFilter}
                        setStatusFilter={setStatusFilter}
                        onSelect={(id) => {
                            setSelectedCampaignId(id);
                            setActiveTab("detail");
                        }}
                    />
                )}
                {activeTab === "create" && (
                    <CreateCampaignPanel
                        onCreated={() => {
                            setActiveTab("campaigns");
                        }}
                    />
                )}
                {activeTab === "detail" && selectedCampaignId && (
                    <CampaignDetailPanel
                        id={selectedCampaignId}
                        onBack={() => setActiveTab("campaigns")}
                    />
                )}
            </div>
        </div>
    );
};

// ── Overview Panel ────────────────────────────────────────────────────────────

function OverviewPanel() {
    const { data, loading, refetch } = useMarketingOverview();

    if (loading) return <Text>Loading overview…</Text>;
    if (!data) return <Text>No data available.</Text>;

    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Total Campaigns" value={data.total} />
                <StatCard label="Active" value={data.active} />
                <StatCard label="Budget Allocated" value={`₹${(data.total_budget_allocated / 100).toFixed(0)}`} />
                <StatCard label="Budget Spent" value={`₹${(data.total_budget_spent / 100).toFixed(0)}`} />
            </div>

            <div className="flex flex-col gap-2">
                <Heading level="h3">By Status</Heading>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(data.by_status).map(([status, count]) => (
                        <Badge key={status} color={STATUS_COLORS[status] ?? "grey"}>
                            {status}: {count}
                        </Badge>
                    ))}
                </div>
            </div>

            <Button variant="secondary" size="small" onClick={refetch}>
                Refresh
            </Button>
        </div>
    );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="flex flex-col gap-1 p-4 border border-ui-border-base rounded-lg bg-ui-bg-subtle">
            <Text className="text-ui-fg-subtle text-xs uppercase tracking-wide">{label}</Text>
            <Text className="text-ui-fg-base text-xl font-semibold">{value}</Text>
        </div>
    );
}

// ── Campaigns List Panel ─────────────────────────────────────────────────────

function CampaignsPanel({
    statusFilter,
    setStatusFilter,
    onSelect,
}: {
    statusFilter: string;
    setStatusFilter: (s: string) => void;
    onSelect: (id: string) => void;
}) {
    const { data, loading, refetch } = useCampaigns(
        statusFilter ? { status: statusFilter } : {}
    );

    return (
        <div className="flex flex-col gap-4">
            <div className="flex gap-4 items-center">
                <div className="w-48">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <Select.Trigger>
                            <Select.Value placeholder="All statuses" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">All statuses</Select.Item>
                            <Select.Item value="draft">Draft</Select.Item>
                            <Select.Item value="active">Active</Select.Item>
                            <Select.Item value="paused">Paused</Select.Item>
                            <Select.Item value="completed">Completed</Select.Item>
                            <Select.Item value="cancelled">Cancelled</Select.Item>
                            <Select.Item value="archived">Archived</Select.Item>
                        </Select.Content>
                    </Select>
                </div>
                <Button variant="secondary" size="small" onClick={refetch}>
                    Refresh
                </Button>
            </div>

            {loading ? (
                <Text>Loading campaigns…</Text>
            ) : data && data.campaigns.length > 0 ? (
                <Table>
                    <Table.Header>
                        <Table.Row>
                            <Table.HeaderCell>Name</Table.HeaderCell>
                            <Table.HeaderCell>Type</Table.HeaderCell>
                            <Table.HeaderCell>Status</Table.HeaderCell>
                            <Table.HeaderCell>Featured</Table.HeaderCell>
                            <Table.HeaderCell>Budget</Table.HeaderCell>
                            <Table.HeaderCell>Goal</Table.HeaderCell>
                            <Table.HeaderCell>Actions</Table.HeaderCell>
                        </Table.Row>
                    </Table.Header>
                    <Table.Body>
                        {data.campaigns.map((c: CampaignDTO) => (
                            <Table.Row key={c.id}>
                                <Table.Cell>
                                    <button
                                        className="text-ui-fg-interactive hover:underline font-medium"
                                        onClick={() => onSelect(c.id)}
                                    >
                                        {c.name}
                                    </button>
                                </Table.Cell>
                                <Table.Cell>{c.type}</Table.Cell>
                                <Table.Cell>
                                    <Badge color={STATUS_COLORS[c.status] ?? "grey"}>{c.status}</Badge>
                                </Table.Cell>
                                <Table.Cell>{c.is_featured ? "★" : "—"}</Table.Cell>
                                <Table.Cell>
                                    {c.budget_total !== null
                                        ? `₹${(c.budget_spent / 100).toFixed(0)}/${(c.budget_total / 100).toFixed(0)}`
                                        : "—"}
                                </Table.Cell>
                                <Table.Cell>
                                    {c.goal_type
                                        ? `${c.goal_type}: ${c.goal_achieved}/${c.goal_target ?? "?"}`
                                        : "—"}
                                </Table.Cell>
                                <Table.Cell>
                                    <div className="flex gap-1">
                                        {c.status === "draft" || c.status === "paused" ? (
                                            <Button
                                                size="small"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await transitionCampaign(c.id, "activate");
                                                    refetch();
                                                }}
                                            >
                                                Activate
                                            </Button>
                                        ) : null}
                                        {c.status === "active" ? (
                                            <Button
                                                size="small"
                                                variant="secondary"
                                                onClick={async () => {
                                                    await transitionCampaign(c.id, "pause");
                                                    refetch();
                                                }}
                                            >
                                                Pause
                                            </Button>
                                        ) : null}
                                    </div>
                                </Table.Cell>
                            </Table.Row>
                        ))}
                    </Table.Body>
                </Table>
            ) : (
                <Text>No campaigns found. Create one from the "Create Campaign" tab.</Text>
            )}
        </div>
    );
}

// ── Create Campaign Panel ────────────────────────────────────────────────────

function CreateCampaignPanel({ onCreated }: { onCreated: () => void }) {
    const [form, setForm] = useState({
        name: "",
        description: "",
        type: "promotion",
        starts_at: "",
        ends_at: "",
        budget_total: "",
        budget_currency: "INR",
        goal_type: "",
        goal_target: "",
        is_featured: false,
        sort_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!form.name.trim()) {
            setError("Campaign name is required.");
            return;
        }
        setSaving(true);
        setError(null);
        try {
            const payload: any = {
                name: form.name,
                description: form.description || null,
                type: form.type,
                starts_at: form.starts_at || null,
                ends_at: form.ends_at || null,
                budget_total: form.budget_total ? Number(form.budget_total) * 100 : null,
                budget_currency: form.budget_currency || null,
                goal_type: form.goal_type || null,
                goal_target: form.goal_target ? Number(form.goal_target) : null,
                is_featured: form.is_featured,
                sort_order: Number(form.sort_order) || 0,
            };
            await createCampaign(payload);
            onCreated();
        } catch (e: any) {
            setError(e.message ?? "Failed to create campaign.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="flex flex-col gap-4 max-w-2xl">
            <div className="flex flex-col gap-1">
                <Label>Campaign Name *</Label>
                <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Diwali Sweets Festival 2026"
                />
            </div>

            <div className="flex flex-col gap-1">
                <Label>Description</Label>
                <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Campaign brief / internal notes"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <Label>Type</Label>
                    <Select
                        value={form.type}
                        onValueChange={(v) => setForm({ ...form, type: v })}
                    >
                        <Select.Trigger>
                            <Select.Value />
                        </Select.Trigger>
                        <Select.Content>
                            {CAMPAIGN_TYPES.map((t) => (
                                <Select.Item key={t} value={t}>
                                    {t}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>

                <div className="flex flex-col gap-1">
                    <Label>Goal Type</Label>
                    <Select
                        value={form.goal_type}
                        onValueChange={(v) => setForm({ ...form, goal_type: v })}
                    >
                        <Select.Trigger>
                            <Select.Value placeholder="None" />
                        </Select.Trigger>
                        <Select.Content>
                            <Select.Item value="">None</Select.Item>
                            {GOAL_TYPES.map((g) => (
                                <Select.Item key={g} value={g}>
                                    {g}
                                </Select.Item>
                            ))}
                        </Select.Content>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                    <Label>Starts At</Label>
                    <Input
                        type="datetime-local"
                        value={form.starts_at}
                        onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Ends At</Label>
                    <Input
                        type="datetime-local"
                        value={form.ends_at}
                        onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col gap-1">
                    <Label>Budget (₹)</Label>
                    <Input
                        type="number"
                        value={form.budget_total}
                        onChange={(e) => setForm({ ...form, budget_total: e.target.value })}
                        placeholder="0"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Currency</Label>
                    <Input
                        value={form.budget_currency}
                        onChange={(e) => setForm({ ...form, budget_currency: e.target.value })}
                        placeholder="INR"
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <Label>Goal Target</Label>
                    <Input
                        type="number"
                        value={form.goal_target}
                        onChange={(e) => setForm({ ...form, goal_target: e.target.value })}
                        placeholder="0"
                    />
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    checked={form.is_featured}
                    onCheckedChange={(v) => setForm({ ...form, is_featured: !!v })}
                />
                <Label>Featured on storefront</Label>
            </div>

            {error && <Text className="text-ui-fg-error">{error}</Text>}

            <div className="flex gap-2">
                <Button onClick={handleSubmit} disabled={saving}>
                    {saving ? "Creating…" : "Create Campaign"}
                </Button>
                <Button variant="secondary" onClick={onCreated}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}

// ── Campaign Detail Panel ────────────────────────────────────────────────────

function CampaignDetailPanel({ id, onBack }: { id: string; onBack: () => void }) {
    const { data, loading, refetch } = useCampaign(id);
    const { data: eventData, loading: eventsLoading } = useCampaignEvents(id);

    if (loading) return <Text>Loading campaign…</Text>;
    if (!data) return <Text>Campaign not found.</Text>;

    const c = data.campaign;

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="secondary" size="small" onClick={onBack}>
                        ← Back
                    </Button>
                    <Heading level="h2">{c.name}</Heading>
                    <Badge color={STATUS_COLORS[c.status] ?? "grey"}>{c.status}</Badge>
                    {c.is_featured && <Badge color="orange">Featured</Badge>}
                </div>
                <div className="flex gap-2">
                    {(c.status === "draft" || c.status === "paused") && (
                        <Button
                            size="small"
                            onClick={async () => {
                                await transitionCampaign(id, "activate");
                                refetch();
                            }}
                        >
                            Activate
                        </Button>
                    )}
                    {c.status === "active" && (
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={async () => {
                                await transitionCampaign(id, "pause");
                                refetch();
                            }}
                        >
                            Pause
                        </Button>
                    )}
                    {(c.status === "active" || c.status === "paused") && (
                        <>
                            <Button
                                size="small"
                                variant="secondary"
                                onClick={async () => {
                                    await transitionCampaign(id, "complete");
                                    refetch();
                                }}
                            >
                                Complete
                            </Button>
                            <Button
                                size="small"
                                variant="danger"
                                onClick={async () => {
                                    await transitionCampaign(id, "cancel");
                                    refetch();
                                }}
                            >
                                Cancel
                            </Button>
                        </>
                    )}
                    {c.status !== "archived" && (
                        <Button
                            size="small"
                            variant="secondary"
                            onClick={async () => {
                                await transitionCampaign(id, "archive");
                                refetch();
                            }}
                        >
                            Archive
                        </Button>
                    )}
                    <Button
                        size="small"
                        variant="danger"
                        onClick={async () => {
                            if (confirm("Permanently delete this campaign?")) {
                                await deleteCampaign(id);
                                onBack();
                            }
                        }}
                    >
                        Delete
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard label="Type" value={c.type} />
                <StatCard
                    label="Budget"
                    value={
                        c.budget_total !== null
                            ? `₹${(c.budget_spent / 100).toFixed(0)}/${(c.budget_total / 100).toFixed(0)}`
                            : "Unlimited"
                    }
                />
                <StatCard
                    label="Goal"
                    value={
                        c.goal_type
                            ? `${c.goal_type}: ${c.goal_achieved}/${c.goal_target ?? "?"}`
                            : "—"
                    }
                />
                <StatCard
                    label="Schedule"
                    value={
                        `${c.starts_at ? new Date(c.starts_at).toLocaleDateString() : "—"} → ${c.ends_at ? new Date(c.ends_at).toLocaleDateString() : "∞"}`
                    }
                />
            </div>

            {c.description && (
                <div className="flex flex-col gap-1">
                    <Heading level="h3">Description</Heading>
                    <Text className="text-ui-fg-subtle">{c.description}</Text>
                </div>
            )}

            <div className="flex flex-col gap-2">
                <Heading level="h3">Lifecycle Events</Heading>
                {eventsLoading ? (
                    <Text>Loading events…</Text>
                ) : eventData && eventData.events.length > 0 ? (
                    <div className="flex flex-col gap-1 max-h-96 overflow-y-auto">
                        {eventData.events.map((e) => (
                            <div
                                key={e.id}
                                className="flex items-start gap-3 p-2 border border-ui-border-base rounded text-sm"
                            >
                                <Badge size="small" color="grey">
                                    {e.event_type}
                                </Badge>
                                <div className="flex flex-col">
                                    <Text className="text-ui-fg-base">{e.note ?? e.event_type}</Text>
                                    <Text className="text-ui-fg-subtle text-xs">
                                        {e.actor} · {new Date(e.created_at).toLocaleString()}
                                    </Text>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Text className="text-ui-fg-subtle">No events recorded.</Text>
                )}
            </div>
        </div>
    );
}

export const config = defineRouteConfig({
    label: "Marketing",
    icon: MarketingIcon,
});

export default MarketingAdminPage;
