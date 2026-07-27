import { useState, useEffect, useCallback } from "react";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface OfferEntry {
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
    conditions: string | null;
    rewards: string | null;
    branch_ids: string | null;
    customer_segments: string | null;
    metadata: string | null;
    total_redemptions: number;
    created_at: string;
    updated_at: string;
}

export interface OfferStats {
    total_redemptions: number;
    total_discount: number;
    total_cashback: number;
    total_loyalty_points: number;
}

interface OffersListResponse {
    offers: OfferEntry[];
}

interface OfferDetailResponse {
    offer: OfferEntry;
    stats: OfferStats;
}

// ─── Hooks ─────────────────────────────────────────────────────────────────────

/**
 * Fetch all offers with optional status/type filters.
 */
export const useOffers = (
    filters?: { status?: string; type?: string }
): {
    data: OffersListResponse | null;
    loading: boolean;
    refetch: () => void;
} => {
    const [data, setData] = useState<OffersListResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters?.status) params.set("status", filters.status);
            if (filters?.type) params.set("type", filters.type);
            const qs = params.toString();
            const url = "/admin/offers" + (qs ? `?${qs}` : "");
            const response = await fetch(url);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching offers", error);
        } finally {
            setLoading(false);
        }
    }, [filters?.status, filters?.type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

/**
 * Fetch a single offer by ID with stats.
 */
export const useOffer = (
    id: string | null
): {
    data: OfferDetailResponse | null;
    loading: boolean;
    refetch: () => void;
} => {
    const [data, setData] = useState<OfferDetailResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!id) {
            setData(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const response = await fetch(`/admin/offers/${id}`);
            const result = await response.json();
            setData(result);
        } catch (error) {
            console.error("Error fetching offer", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, refetch: fetchData };
};

// ─── Mutation Helpers ──────────────────────────────────────────────────────────

/**
 * Create a new offer.
 */
export const createOffer = async (
    payload: Record<string, unknown>
): Promise<{ success: boolean; offer?: OfferEntry; error?: string }> => {
    try {
        const response = await fetch("/admin/offers", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (response.ok) {
            return { success: true, offer: result.offer };
        }
        return { success: false, error: result.message || "Failed to create offer" };
    } catch (err) {
        return { success: false, error: String(err) };
    }
};

/**
 * Update an existing offer.
 */
export const updateOffer = async (
    id: string,
    payload: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch(`/admin/offers/${id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (response.ok) return { success: true };
        const result = await response.json();
        return { success: false, error: result.message || "Failed to update offer" };
    } catch (err) {
        return { success: false, error: String(err) };
    }
};

/**
 * Delete an offer.
 */
export const deleteOffer = async (
    id: string
): Promise<{ success: boolean; error?: string }> => {
    try {
        const response = await fetch(`/admin/offers/${id}`, {
            method: "DELETE",
        });
        if (response.ok) return { success: true };
        return { success: false, error: "Failed to delete offer" };
    } catch (err) {
        return { success: false, error: String(err) };
    }
};

/**
 * Test-evaluate offers against a context (admin only).
 */
export const evaluateOffers = async (
    context: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> => {
    try {
        const response = await fetch("/admin/offers/evaluate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(context),
        });
        const data = await response.json();
        if (response.ok) return { success: true, result: data.result };
        return { success: false, error: data.message || "Evaluation failed" };
    } catch (err) {
        return { success: false, error: String(err) };
    }
};
