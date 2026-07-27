import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface CmsPageEntry {
    id: string;
    slug: string;
    title: string;
    type: string;
    status: string;
    meta_title?: string | null;
    meta_description?: string | null;
    author?: string | null;
    excerpt?: string | null;
    published_at?: string | null;
    language_code?: string;
}

export interface HomepageSectionEntry {
    id: string;
    name: string;
    section_type: string;
    title?: string | null;
    subtitle?: string | null;
    sort_order: number;
    is_active: boolean;
    language_code?: string;
}

export interface BannerEntry {
    id: string;
    title?: string | null;
    image_url: string;
    link_url?: string | null;
    sort_order: number;
    is_active: boolean;
}

export interface NavigationEntry {
    id: string;
    name: string;
    location: string;
    is_active: boolean;
    language_code?: string;
}

export interface RedirectEntry {
    id: string;
    from_path: string;
    to_url: string;
    redirect_type: number;
    is_active: boolean;
}

// ── Pages ──────────────────────────────────────────────────────────────────

export const useCmsPages = (filters: { status?: string; type?: string } = {}) => {
    const [data, setData] = useState<{ pages: CmsPageEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            if (filters.type) params.set("type", filters.type);
            const qs = params.toString();
            const res = await fetch(`/admin/cms/pages${qs ? `?${qs}` : ""}`);
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching CMS pages", e);
        } finally {
            setLoading(false);
        }
    }, [filters.status, filters.type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

export async function createCmsPage(input: Record<string, unknown>) {
    const res = await fetch("/admin/cms/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function updateCmsPage(id: string, input: Record<string, unknown>) {
    const res = await fetch(`/admin/cms/pages/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function publishCmsPage(id: string) {
    const res = await fetch(`/admin/cms/pages/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    return res.json();
}

export async function archiveCmsPage(id: string) {
    const res = await fetch(`/admin/cms/pages/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });
    return res.json();
}

export async function deleteCmsPage(id: string) {
    await fetch(`/admin/cms/pages/${id}`, { method: "DELETE" });
}

// ── Homepage sections ───────────────────────────────────────────────────────

export const useHomepageSections = () => {
    const [data, setData] = useState<{ sections: HomepageSectionEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/admin/cms/homepage");
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching homepage sections", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

export async function createHomepageSection(input: Record<string, unknown>) {
    const res = await fetch("/admin/cms/homepage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function updateHomepageSection(id: string, input: Record<string, unknown>) {
    const res = await fetch(`/admin/cms/homepage/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function deleteHomepageSection(id: string) {
    await fetch(`/admin/cms/homepage/${id}`, { method: "DELETE" });
}

export async function reorderHomepageSections(orderedIds: string[]) {
    const res = await fetch("/admin/cms/homepage/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ordered_ids: orderedIds }),
    });
    return res.json();
}

// ── Banners ────────────────────────────────────────────────────────────────

export const useBanners = () => {
    const [data, setData] = useState<{ banners: BannerEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/admin/cms/banners");
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching banners", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

export async function createBanner(input: Record<string, unknown>) {
    const res = await fetch("/admin/cms/banners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function deleteBanner(id: string) {
    await fetch(`/admin/cms/banners/${id}`, { method: "DELETE" });
}

// ── Navigation ──────────────────────────────────────────────────────────────

export const useNavigations = () => {
    const [data, setData] = useState<{ navigations: NavigationEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/admin/cms/navigation");
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching navigations", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

export async function createNavigation(input: Record<string, unknown>) {
    const res = await fetch("/admin/cms/navigation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function deleteNavigation(id: string) {
    await fetch(`/admin/cms/navigation/${id}`, { method: "DELETE" });
}

// ── Redirects ───────────────────────────────────────────────────────────────

export const useRedirects = () => {
    const [data, setData] = useState<{ redirects: RedirectEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/admin/cms/redirects");
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching redirects", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

export async function createRedirect(input: Record<string, unknown>) {
    const res = await fetch("/admin/cms/redirects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
}

export async function deleteRedirect(id: string) {
    await fetch(`/admin/cms/redirects/${id}`, { method: "DELETE" });
}

// ── SEO Dashboard ───────────────────────────────────────────────────────────

export interface SeoOverview {
    pages: {
        total: number;
        published: number;
        draft: number;
        archived: number;
        missing_meta_title: number;
        missing_meta_description: number;
        meta_coverage_percent: number;
    };
    blog: { total: number; published: number };
    redirects: { total: number; active: number };
    homepage_sections: { total: number; active: number };
    banners: { total: number; active: number };
    navigations: { total: number; active: number };
}

export const useSeoOverview = () => {
    const [data, setData] = useState<{ overview: SeoOverview } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/admin/cms/seo");
            const result = await res.json();
            setData(result);
        } catch (e) {
            console.error("Error fetching SEO overview", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};
