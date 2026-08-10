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
import { CmsIcon } from "../../components/icons";
import {
    useCmsPages,
    useHomepageSections,
    useBanners,
    useNavigations,
    useRedirects,
    useSeoOverview,
    createCmsPage,
    updateCmsPage,
    publishCmsPage,
    archiveCmsPage,
    deleteCmsPage,
    createHomepageSection,
    updateHomepageSection,
    deleteHomepageSection,
    createBanner,
    deleteBanner,
    createNavigation,
    deleteNavigation,
    createRedirect,
    deleteRedirect,
} from "../../hooks/use-cms";

const SECTION_TYPES = [
    "hero", "slider", "featured_cakes", "categories", "birthday_collection",
    "anniversary_collection", "same_day_delivery", "trending", "offers", "coupons",
    "product_carousel", "category_carousel", "gallery", "testimonials", "faq",
    "instagram", "blog", "video", "countdown", "rich_text", "custom_html",
    "branches", "delivery_areas", "recently_viewed", "recommended",
];

const NAV_LOCATIONS = ["header", "footer", "mega_menu", "sidebar", "mobile"];

const CmsPage = () => {
    const [tab, setTab] = useState<"pages" | "homepage" | "banners" | "navigation" | "redirects" | "seo">("pages");

    return (
        <Container className="p-6 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <Heading level="h1">CMS</Heading>
                <div className="flex gap-2">
                    {(["pages", "homepage", "banners", "navigation", "redirects", "seo"] as const).map((t) => (
                        <Button
                            key={t}
                            variant={tab === t ? "secondary" : "transparent"}
                            size="small"
                            onClick={() => setTab(t)}
                        >
                            {t === "seo" ? "SEO Dashboard" : t.charAt(0).toUpperCase() + t.slice(1)}
                        </Button>
                    ))}
                </div>
            </div>

            {tab === "pages" && <PagesTab />}
            {tab === "homepage" && <HomepageTab />}
            {tab === "banners" && <BannersTab />}
            {tab === "navigation" && <NavigationTab />}
            {tab === "redirects" && <RedirectsTab />}
            {tab === "seo" && <SeoTab />}
        </Container>
    );
};

// ── Pages tab ──────────────────────────────────────────────────────────────

function PagesTab() {
    const { data, loading, refetch } = useCmsPages();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({
        slug: "",
        title: "",
        type: "page",
        status: "draft",
        meta_title: "",
        meta_description: "",
        excerpt: "",
        author: "",
    });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!form.slug || !form.title) return;
        setSaving(true);
        await createCmsPage({
            slug: form.slug,
            title: form.title,
            type: form.type,
            status: form.status,
            meta_title: form.meta_title || null,
            meta_description: form.meta_description || null,
            excerpt: form.excerpt || null,
            author: form.author || null,
        });
        setForm({ slug: "", title: "", type: "page", status: "draft", meta_title: "", meta_description: "", excerpt: "", author: "" });
        setShowForm(false);
        setSaving(false);
        refetch();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">Content pages & blog posts</Text>
                <Button variant={showForm ? "transparent" : "secondary"} size="small" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Cancel" : "New page"}
                </Button>
            </div>

            {showForm && (
                <div className="flex flex-col gap-3 border rounded p-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="slug">Slug</Label>
                            <Input id="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="about-us" />
                        </div>
                        <div>
                            <Label htmlFor="title">Title</Label>
                            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="type">Type</Label>
                            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                                <Select.Trigger><Select.Value /></Select.Trigger>
                                <Select.Content>
                                    <Select.Item value="page">Page</Select.Item>
                                    <Select.Item value="blog">Blog</Select.Item>
                                    <Select.Item value="landing">Landing</Select.Item>
                                    <Select.Item value="static">Static</Select.Item>
                                </Select.Content>
                            </Select>
                        </div>
                        <div>
                            <Label htmlFor="status">Status</Label>
                            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                                <Select.Trigger><Select.Value /></Select.Trigger>
                                <Select.Content>
                                    <Select.Item value="draft">Draft</Select.Item>
                                    <Select.Item value="published">Published</Select.Item>
                                    <Select.Item value="archived">Archived</Select.Item>
                                </Select.Content>
                            </Select>
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="meta_title">Meta Title</Label>
                        <Input id="meta_title" value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="meta_description">Meta Description</Label>
                        <Textarea id="meta_description" value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="excerpt">Excerpt</Label>
                        <Textarea id="excerpt" value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="author">Author</Label>
                        <Input id="author" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
                    </div>
                    <Button size="large" isLoading={saving} onClick={handleCreate}>Create page</Button>
                </div>
            )}

            {loading ? (
                <Text>Loading...</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {(data?.pages ?? []).map((page) => (
                        <div key={page.id} className="border rounded p-4 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <Text className="font-medium">{page.title}</Text>
                                <Text className="text-ui-fg-subtle text-sm">/{page.slug} · {page.type}</Text>
                            </div>
                            <div className="flex gap-2 items-center">
                                <StatusBadge color={page.status === "published" ? "green" : page.status === "archived" ? "red" : "orange"}>
                                    {page.status}
                                </StatusBadge>
                                {page.status !== "published" && (
                                    <Button size="small" variant="secondary" onClick={async () => { await publishCmsPage(page.id); refetch(); }}>
                                        Publish
                                    </Button>
                                )}
                                {page.status !== "archived" && (
                                    <Button size="small" variant="transparent" onClick={async () => { await archiveCmsPage(page.id); refetch(); }}>
                                        Archive
                                    </Button>
                                )}
                                <Button size="small" variant="danger" onClick={async () => { await deleteCmsPage(page.id); refetch(); }}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                    {(data?.pages ?? []).length === 0 && <Text className="text-ui-fg-subtle">No pages yet.</Text>}
                </div>
            )}
        </div>
    );
}

// ── Homepage tab ───────────────────────────────────────────────────────────

function HomepageTab() {
    const { data, loading, refetch } = useHomepageSections();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", section_type: "hero", title: "", subtitle: "" });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!form.name) return;
        setSaving(true);
        await createHomepageSection({
            name: form.name,
            section_type: form.section_type,
            title: form.title || null,
            subtitle: form.subtitle || null,
        });
        setForm({ name: "", section_type: "hero", title: "", subtitle: "" });
        setShowForm(false);
        setSaving(false);
        refetch();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">Homepage builder sections (drag-and-drop ordering via reorder API)</Text>
                <Button variant={showForm ? "transparent" : "secondary"} size="small" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Cancel" : "Add section"}
                </Button>
            </div>

            {showForm && (
                <div className="flex flex-col gap-3 border rounded p-4">
                    <div>
                        <Label htmlFor="hs-name">Name</Label>
                        <Input id="hs-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="hs-type">Section Type</Label>
                        <Select value={form.section_type} onValueChange={(v) => setForm({ ...form, section_type: v })}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                                {SECTION_TYPES.map((t) => (
                                    <Select.Item key={t} value={t}>{t}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor="hs-title">Title</Label>
                        <Input id="hs-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="hs-subtitle">Subtitle</Label>
                        <Input id="hs-subtitle" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
                    </div>
                    <Button size="large" isLoading={saving} onClick={handleCreate}>Add section</Button>
                </div>
            )}

            {loading ? (
                <Text>Loading...</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {(data?.sections ?? []).sort((a, b) => a.sort_order - b.sort_order).map((section) => (
                        <div key={section.id} className="border rounded p-4 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <Text className="font-medium">{section.name}</Text>
                                <Text className="text-ui-fg-subtle text-sm">{section.section_type} · order {section.sort_order}</Text>
                            </div>
                            <div className="flex gap-2 items-center">
                                <Switch
                                    checked={section.is_active}
                                    onCheckedChange={async (v) => { await updateHomepageSection(section.id, { is_active: v }); refetch(); }}
                                />
                                <Button size="small" variant="danger" onClick={async () => { await deleteHomepageSection(section.id); refetch(); }}>
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))}
                    {(data?.sections ?? []).length === 0 && <Text className="text-ui-fg-subtle">No homepage sections yet.</Text>}
                </div>
            )}
        </div>
    );
}

// ── Banners tab ────────────────────────────────────────────────────────────

function BannersTab() {
    const { data, loading, refetch } = useBanners();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: "", image_url: "", link_url: "" });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!form.image_url) return;
        setSaving(true);
        await createBanner({
            title: form.title || null,
            image_url: form.image_url,
            link_url: form.link_url || null,
        });
        setForm({ title: "", image_url: "", link_url: "" });
        setShowForm(false);
        setSaving(false);
        refetch();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">Homepage banner slider</Text>
                <Button variant={showForm ? "transparent" : "secondary"} size="small" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Cancel" : "Add banner"}
                </Button>
            </div>

            {showForm && (
                <div className="flex flex-col gap-3 border rounded p-4">
                    <div>
                        <Label htmlFor="bnr-title">Title</Label>
                        <Input id="bnr-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="bnr-img">Image URL</Label>
                        <Input id="bnr-img" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="bnr-link">Link URL</Label>
                        <Input id="bnr-link" value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
                    </div>
                    <Button size="large" isLoading={saving} onClick={handleCreate}>Add banner</Button>
                </div>
            )}

            {loading ? (
                <Text>Loading...</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {(data?.banners ?? []).map((banner) => (
                        <div key={banner.id} className="border rounded p-4 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <Text className="font-medium">{banner.title ?? "Untitled banner"}</Text>
                                <Text className="text-ui-fg-subtle text-sm truncate max-w-md">{banner.image_url}</Text>
                            </div>
                            <Button size="small" variant="danger" onClick={async () => { await deleteBanner(banner.id); refetch(); }}>
                                Delete
                            </Button>
                        </div>
                    ))}
                    {(data?.banners ?? []).length === 0 && <Text className="text-ui-fg-subtle">No banners yet.</Text>}
                </div>
            )}
        </div>
    );
}

// ── Navigation tab ─────────────────────────────────────────────────────────

function NavigationTab() {
    const { data, loading, refetch } = useNavigations();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: "", location: "header" });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!form.name) return;
        setSaving(true);
        await createNavigation({ name: form.name, location: form.location, items: [] });
        setForm({ name: "", location: "header" });
        setShowForm(false);
        setSaving(false);
        refetch();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">Navigation trees (header, footer, mega-menu, sidebar, mobile)</Text>
                <Button variant={showForm ? "transparent" : "secondary"} size="small" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Cancel" : "New navigation"}
                </Button>
            </div>

            {showForm && (
                <div className="flex flex-col gap-3 border rounded p-4">
                    <div>
                        <Label htmlFor="nav-name">Name</Label>
                        <Input id="nav-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </div>
                    <div>
                        <Label htmlFor="nav-loc">Location</Label>
                        <Select value={form.location} onValueChange={(v) => setForm({ ...form, location: v })}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                                {NAV_LOCATIONS.map((l) => (
                                    <Select.Item key={l} value={l}>{l}</Select.Item>
                                ))}
                            </Select.Content>
                        </Select>
                    </div>
                    <Button size="large" isLoading={saving} onClick={handleCreate}>Create navigation</Button>
                </div>
            )}

            {loading ? (
                <Text>Loading...</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {(data?.navigations ?? []).map((nav) => (
                        <div key={nav.id} className="border rounded p-4 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <Text className="font-medium">{nav.name}</Text>
                                <Badge size="small">{nav.location}</Badge>
                            </div>
                            <Button size="small" variant="danger" onClick={async () => { await deleteNavigation(nav.id); refetch(); }}>
                                Delete
                            </Button>
                        </div>
                    ))}
                    {(data?.navigations ?? []).length === 0 && <Text className="text-ui-fg-subtle">No navigations yet.</Text>}
                </div>
            )}
        </div>
    );
}

// ── Redirects tab ──────────────────────────────────────────────────────────

function RedirectsTab() {
    const { data, loading, refetch } = useRedirects();
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ from_path: "", to_url: "", redirect_type: 301 });
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!form.from_path || !form.to_url) return;
        setSaving(true);
        await createRedirect({
            from_path: form.from_path,
            to_url: form.to_url,
            redirect_type: Number(form.redirect_type),
        });
        setForm({ from_path: "", to_url: "", redirect_type: 301 });
        setShowForm(false);
        setSaving(false);
        refetch();
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">301/302 redirect manager</Text>
                <Button variant={showForm ? "transparent" : "secondary"} size="small" onClick={() => setShowForm((s) => !s)}>
                    {showForm ? "Cancel" : "Add redirect"}
                </Button>
            </div>

            {showForm && (
                <div className="flex flex-col gap-3 border rounded p-4">
                    <div>
                        <Label htmlFor="red-from">From Path</Label>
                        <Input id="red-from" value={form.from_path} onChange={(e) => setForm({ ...form, from_path: e.target.value })} placeholder="/old-page" />
                    </div>
                    <div>
                        <Label htmlFor="red-to">To URL</Label>
                        <Input id="red-to" value={form.to_url} onChange={(e) => setForm({ ...form, to_url: e.target.value })} placeholder="/new-page" />
                    </div>
                    <div>
                        <Label htmlFor="red-type">Redirect Type</Label>
                        <Select value={String(form.redirect_type)} onValueChange={(v) => setForm({ ...form, redirect_type: Number(v) })}>
                            <Select.Trigger><Select.Value /></Select.Trigger>
                            <Select.Content>
                                <Select.Item value="301">301 (Permanent)</Select.Item>
                                <Select.Item value="302">302 (Temporary)</Select.Item>
                            </Select.Content>
                        </Select>
                    </div>
                    <Button size="large" isLoading={saving} onClick={handleCreate}>Add redirect</Button>
                </div>
            )}

            {loading ? (
                <Text>Loading...</Text>
            ) : (
                <div className="flex flex-col gap-2">
                    {(data?.redirects ?? []).map((redirect) => (
                        <div key={redirect.id} className="border rounded p-4 flex justify-between items-center">
                            <div className="flex flex-col gap-1">
                                <Text className="font-medium">{redirect.from_path} → {redirect.to_url}</Text>
                                <Badge size="small">{redirect.redirect_type}</Badge>
                            </div>
                            <Button size="small" variant="danger" onClick={async () => { await deleteRedirect(redirect.id); refetch(); }}>
                                Delete
                            </Button>
                        </div>
                    ))}
                    {(data?.redirects ?? []).length === 0 && <Text className="text-ui-fg-subtle">No redirects yet.</Text>}
                </div>
            )}
        </div>
    );
}

// ── SEO Dashboard tab ───────────────────────────────────────────────────────

function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
    return (
        <div className="border rounded p-4 flex flex-col gap-1">
            <Text className="text-ui-fg-subtle text-sm">{label}</Text>
            <Text className="text-2xl font-semibold">{value}</Text>
            {hint && <Text className="text-ui-fg-subtle text-xs">{hint}</Text>}
        </div>
    );
}

function SeoTab() {
    const { data, loading, refetch } = useSeoOverview();

    if (loading) return <Text>Loading SEO overview…</Text>;
    const o = data?.overview;
    if (!o) return <Text className="text-ui-fg-subtle">No SEO data available.</Text>;

    const coverageColor =
        o.pages.meta_coverage_percent >= 80 ? "green" : o.pages.meta_coverage_percent >= 50 ? "orange" : "red";

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">SEO health overview across all CMS content</Text>
                <Button size="small" variant="transparent" onClick={refetch}>Refresh</Button>
            </div>

            <div>
                <Heading level="h3">Meta Coverage</Heading>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    <StatCard label="Published Pages" value={o.pages.published} />
                    <StatCard label="Missing Meta Title" value={o.pages.missing_meta_title} />
                    <StatCard label="Missing Meta Description" value={o.pages.missing_meta_description} />
                    <div className="border rounded p-4 flex flex-col gap-1">
                        <Text className="text-ui-fg-subtle text-sm">Meta Coverage</Text>
                        <StatusBadge color={coverageColor}>{o.pages.meta_coverage_percent}%</StatusBadge>
                    </div>
                </div>
            </div>

            <div>
                <Heading level="h3">Content Inventory</Heading>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
                    <StatCard label="Total Pages" value={o.pages.total} hint={`${o.pages.draft} draft · ${o.pages.archived} archived`} />
                    <StatCard label="Blog Posts" value={o.blog.total} hint={`${o.blog.published} published`} />
                    <StatCard label="Homepage Sections" value={o.homepage_sections.total} hint={`${o.homepage_sections.active} active`} />
                    <StatCard label="Banners" value={o.banners.total} hint={`${o.banners.active} active`} />
                </div>
            </div>

            <div>
                <Heading level="h3">Redirects & Navigation</Heading>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                    <StatCard label="Redirects" value={o.redirects.total} hint={`${o.redirects.active} active`} />
                    <StatCard label="Navigations" value={o.navigations.total} hint={`${o.navigations.active} active`} />
                </div>
            </div>
        </div>
    );
}

export const config = defineRouteConfig({
    label: "CMS",
    icon: CmsIcon,
});

export default CmsPage;
