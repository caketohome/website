import { useState, useEffect, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface CampaignDTO {
    id: string;
    name: string;
    description: string | null;
    type: string;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
    budget_total: number | null;
    budget_currency: string | null;
    budget_spent: number;
    goal_type: string | null;
    goal_target: number | null;
    goal_achieved: number;
    targeting: any;
    channels: any;
    offer_ids: string[] | null;
    segment_ids: string[] | null;
    branch_ids: string[] | null;
    automation_flow_ids: string[] | null;
    is_featured: boolean;
    sort_order: number;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export interface CampaignEventDTO {
    id: string;
    campaign_id: string;
    event_type: string;
    actor: string;
    note: string | null;
    payload: any;
    created_at: string;
}

export interface MarketingOverview {
    total: number;
    by_status: Record<string, number>;
    active: number;
    total_budget_allocated: number;
    total_budget_spent: number;
}

// ── Hooks ────────────────────────────────────────────────────────────────────

export const useMarketingOverview = () => {
    const [data, setData] = useState<MarketingOverview | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const response = await fetch("/admin/marketing/overview");
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching marketing overview", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, []);

    return { data, loading, refetch };
};

export const useCampaigns = (filters: { status?: string; type?: string } = {}) => {
    const [data, setData] = useState<{ campaigns: CampaignDTO[]; count: number } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            if (filters.type) params.set("type", filters.type);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/campaigns${qs}`);
            const result = await response.json();
            setData({ campaigns: result.campaigns ?? [], count: result.count ?? 0 });
        } catch (error) {
            console.error("Error fetching campaigns", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.status, filters.type]);

    return { data, loading, refetch };
};

export const useCampaign = (id: string | null) => {
    const [data, setData] = useState<{ campaign: CampaignDTO } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await fetch(`/admin/marketing/campaigns/${id}`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching campaign", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [id]);

    return { data, loading, refetch };
};

export const useCampaignEvents = (id: string | null) => {
    const [data, setData] = useState<{ events: CampaignEventDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const response = await fetch(`/admin/marketing/campaigns/${id}/events`);
            const result = await response.json();
            setData({ events: result.events ?? [] });
        } catch (error) {
            console.error("Error fetching campaign events", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [id]);

    return { data, loading, refetch };
};

// ── Mutation helpers ─────────────────────────────────────────────────────────

export const createCampaign = async (input: Partial<CampaignDTO>) => {
    const response = await fetch("/admin/marketing/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const updateCampaign = async (id: string, input: Partial<CampaignDTO>) => {
    const response = await fetch(`/admin/marketing/campaigns/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const deleteCampaign = async (id: string) => {
    const response = await fetch(`/admin/marketing/campaigns/${id}`, {
        method: "DELETE",
    });
    return response.json();
};

export const transitionCampaign = async (
    id: string,
    action: "activate" | "pause" | "complete" | "cancel" | "archive"
) => {
    const response = await fetch(`/admin/marketing/campaigns/${id}/${action}`, {
        method: "POST",
    });
    return response.json();
};

// ── Phase 9.2 — Toolkit hooks (offers, popups, gamification, qr, newsletter, recovery) ──

// ── Offers (M2 Rules Engine) ──────────────────────────────────────────────────

export interface OfferDTO {
    id: string;
    name: string;
    code: string | null;
    type: string;
    status: string;
    priority: number;
    starts_at: string | null;
    ends_at: string | null;
    usage_limit: number | null;
    per_customer_limit: number | null;
    is_stackable: boolean;
    is_public: boolean;
    description: string | null;
    conditions: any;
    rewards: any;
    branch_ids: string[] | null;
    customer_segments: string[] | null;
    metadata: any;
    total_redemptions: number;
    created_at: string;
    updated_at: string;
}

export const useOffers = (filters: { status?: string; type?: string } = {}) => {
    const [data, setData] = useState<{ offers: OfferDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            if (filters.type) params.set("type", filters.type);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/offers${qs}`);
            const result = await response.json();
            setData({ offers: result.offers ?? [] });
        } catch (error) {
            console.error("Error fetching offers", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.status, filters.type]);

    return { data, loading, refetch };
};

export const createOffer = async (input: any) => {
    const response = await fetch("/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const updateOffer = async (id: string, input: any) => {
    const response = await fetch(`/admin/offers/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const deleteOffer = async (id: string) => {
    const response = await fetch(`/admin/offers/${id}`, { method: "DELETE" });
    return response.json();
};

export const createTypedOffer = async (input: any) => {
    const response = await fetch("/admin/offers/factory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const bulkGenerateCoupons = async (input: any) => {
    const response = await fetch("/admin/offers/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

// ── Popups ───────────────────────────────────────────────────────────────────

export interface PopupDTO {
    id: string;
    name: string;
    trigger: string;
    headline: string | null;
    body: string | null;
    cta_label: string | null;
    cta_url: string | null;
    image_url: string | null;
    offer_code: string | null;
    display_rules: any;
    status: string;
    sort_order: number;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const usePopups = (filters: { status?: string } = {}) => {
    const [data, setData] = useState<{ popups: PopupDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/popups${qs}`);
            const result = await response.json();
            setData({ popups: result.popups ?? [] });
        } catch (error) {
            console.error("Error fetching popups", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.status]);

    return { data, loading, refetch };
};

export const createPopup = async (input: any) => {
    const response = await fetch("/admin/marketing/popups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const updatePopup = async (id: string, input: any) => {
    const response = await fetch(`/admin/marketing/popups/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const deletePopup = async (id: string) => {
    const response = await fetch(`/admin/marketing/popups/${id}`, {
        method: "DELETE",
    });
    return response.json();
};

// ── Gamification ──────────────────────────────────────────────────────────────

export interface GamificationRewardDTO {
    id: string;
    widget_type: string;
    name: string;
    offer_id: string | null;
    customer_id: string | null;
    session_id: string | null;
    outcome: string;
    reward_label: string | null;
    coupon_code: string | null;
    reward_value: number;
    redeemed: boolean;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const useGamificationRewards = (
    filters: { widget_type?: string; outcome?: string } = {}
) => {
    const [data, setData] = useState<{ rewards: GamificationRewardDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.widget_type) params.set("widget_type", filters.widget_type);
            if (filters.outcome) params.set("outcome", filters.outcome);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/gamification${qs}`);
            const result = await response.json();
            setData({ rewards: result.rewards ?? [] });
        } catch (error) {
            console.error("Error fetching gamification rewards", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.widget_type, filters.outcome]);

    return { data, loading, refetch };
};

// ── QR Codes ──────────────────────────────────────────────────────────────────

export interface QRCodeDTO {
    id: string;
    name: string;
    code: string;
    target_type: string;
    target_id: string | null;
    offer_code: string | null;
    campaign_id: string | null;
    scan_count: number;
    status: string;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const useQRCodes = (filters: { status?: string } = {}) => {
    const [data, setData] = useState<{ qr_codes: QRCodeDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/qr-codes${qs}`);
            const result = await response.json();
            setData({ qr_codes: result.qr_codes ?? [] });
        } catch (error) {
            console.error("Error fetching QR codes", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.status]);

    return { data, loading, refetch };
};

export const createQRCode = async (input: any) => {
    const response = await fetch("/admin/marketing/qr-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return response.json();
};

export const deleteQRCode = async (id: string) => {
    const response = await fetch(`/admin/marketing/qr-codes/${id}`, {
        method: "DELETE",
    });
    return response.json();
};

// ── Newsletter ─────────────────────────────────────────────────────────────────

export interface NewsletterSubscriberDTO {
    id: string;
    email: string;
    phone: string | null;
    customer_id: string | null;
    status: string;
    source: string;
    tags: string[] | null;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const useNewsletterSubscribers = (
    filters: { status?: string; source?: string } = {}
) => {
    const [data, setData] = useState<{ subscribers: NewsletterSubscriberDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.set("status", filters.status);
            if (filters.source) params.set("source", filters.source);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/newsletter${qs}`);
            const result = await response.json();
            setData({ subscribers: result.subscribers ?? [] });
        } catch (error) {
            console.error("Error fetching newsletter subscribers", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.status, filters.source]);

    return { data, loading, refetch };
};

// ── Recovery Jobs ─────────────────────────────────────────────────────────────

export interface RecoveryJobDTO {
    id: string;
    type: string;
    customer_id: string | null;
    session_id: string | null;
    cart_id: string | null;
    email: string | null;
    phone: string | null;
    stage: string;
    scheduled_at: string | null;
    sent_at: string | null;
    recovered_at: string | null;
    offer_code: string | null;
    attempts: number;
    metadata: any;
    created_at: string;
    updated_at: string;
}

export const useRecoveryJobs = (
    filters: { type?: string; stage?: string } = {}
) => {
    const [data, setData] = useState<{ jobs: RecoveryJobDTO[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.type) params.set("type", filters.type);
            if (filters.stage) params.set("stage", filters.stage);
            const qs = params.toString() ? `?${params.toString()}` : "";
            const response = await fetch(`/admin/marketing/recovery${qs}`);
            const result = await response.json();
            setData({ jobs: result.jobs ?? [] });
        } catch (error) {
            console.error("Error fetching recovery jobs", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refetch();
    }, [filters.type, filters.stage]);

    return { data, loading, refetch };
};

export const markRecoveryJobSent = async (id: string) => {
    const response = await fetch(`/admin/marketing/recovery/${id}/sent`, {
        method: "POST",
    });
    return response.json();
};

export const markRecoveryJobRecovered = async (id: string) => {
    const response = await fetch(`/admin/marketing/recovery/${id}/recovered`, {
        method: "POST",
    });
    return response.json();
};

export const cancelRecoveryJob = async (id: string) => {
    const response = await fetch(`/admin/marketing/recovery/${id}/cancel`, {
        method: "POST",
    });
    return response.json();
};
