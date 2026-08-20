import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProductMetaEntry {
    id: string;
    product_id: string;
    artisan: boolean;
    sugar_free: boolean;
    gluten_free: boolean;
    vegan: boolean;
    ingredients?: string | null;
    allergens?: string | null;
    nutritional_info?: string | null;
    shelf_life?: string | null;
    storage_instructions?: string | null;
    fssai_license?: string | null;
    video_url?: string | null;
    is_featured: boolean;
    is_bestseller: boolean;
    is_new_arrival: boolean;
    search_document?: string | null;
    meta?: string | null;
}

export interface ReviewEntry {
    id: string;
    product_id: string;
    customer_id?: string | null;
    customer_name?: string | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    images?: string | null;
    status: string;
    reply?: string | null;
    replied_at?: string | null;
    verified_purchase: boolean;
    created_at?: string;
}

export interface SubscriptionEntry {
    id: string;
    customer_id: string;
    product_id: string;
    variant_id?: string | null;
    frequency: string;
    quantity: number;
    next_date: string;
    status: string;
    max_deliveries?: number | null;
    deliveries_count: number;
}

export interface StockNotificationEntry {
    id: string;
    product_id: string;
    variant_id?: string | null;
    customer_id?: string | null;
    email?: string | null;
    phone?: string | null;
    status: string;
    notified_at?: string | null;
}

// ── Product Meta ────────────────────────────────────────────────────────────

export const useProductMeta = (productId?: string) => {
    const [data, setData] = useState<{ metas: ProductMetaEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMeta = async () => {
            try {
                const url = "/admin/catalog/product-meta" + (productId ? `?product_id=${productId}` : "");
                const res = await fetch(url);
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching product meta", error);
            } finally {
                setLoading(false);
            }
        };
        fetchMeta();
    }, [productId]);

    return { data, loading };
};

export const upsertProductMeta = async (input: Record<string, unknown>) => {
    const res = await fetch("/admin/catalog/product-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const updateProductMeta = async (productId: string, input: Record<string, unknown>) => {
    const res = await fetch(`/admin/catalog/product-meta/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const deleteProductMeta = async (productId: string) => {
    const res = await fetch(`/admin/catalog/product-meta/${productId}`, { method: "DELETE" });
    return res.json();
};

// ── Reviews ─────────────────────────────────────────────────────────────────

export const useReviews = (filters: { status?: string; product_id?: string } = {}) => {
    const [data, setData] = useState<{ reviews: ReviewEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.product_id) params.set("product_id", filters.product_id);

    useEffect(() => {
        const fetchReviews = async () => {
            try {
                const res = await fetch(`/admin/catalog/reviews?${params.toString()}`);
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching reviews", error);
            } finally {
                setLoading(false);
            }
        };
        fetchReviews();
    }, [filters.status, filters.product_id]);

    return { data, loading };
};

export const moderateReview = async (reviewId: string, input: { status: "approved" | "rejected"; reply?: string }) => {
    const res = await fetch(`/admin/catalog/reviews/${reviewId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const deleteReview = async (reviewId: string) => {
    const res = await fetch(`/admin/catalog/reviews/${reviewId}`, { method: "DELETE" });
    return res.json();
};

// ── Subscriptions ───────────────────────────────────────────────────────────

export const useSubscriptions = (filters: { status?: string; customer_id?: string } = {}) => {
    const [data, setData] = useState<{ subscriptions: SubscriptionEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.customer_id) params.set("customer_id", filters.customer_id);

    useEffect(() => {
        const fetchSubs = async () => {
            try {
                const res = await fetch(`/admin/catalog/subscriptions?${params.toString()}`);
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching subscriptions", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSubs();
    }, [filters.status, filters.customer_id]);

    return { data, loading };
};

// ── Stock Notifications ─────────────────────────────────────────────────────

export const useStockNotifications = (filters: { status?: string; product_id?: string } = {}) => {
    const [data, setData] = useState<{ notifications: StockNotificationEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    const params = new URLSearchParams();
    if (filters.status) params.set("status", filters.status);
    if (filters.product_id) params.set("product_id", filters.product_id);

    useEffect(() => {
        const fetchNotifications = async () => {
            try {
                const res = await fetch(`/admin/catalog/stock-notifications?${params.toString()}`);
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching stock notifications", error);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, [filters.status, filters.product_id]);

    return { data, loading };
};

export const notifyStockRestocked = async (productId: string) => {
    const res = await fetch(`/admin/catalog/stock-notifications/${productId}/notify`, { method: "POST" });
    return res.json();
};

// ── AI Generation ───────────────────────────────────────────────────────────

export const generateProductDescription = async (productId: string): Promise<{ description: string }> => {
    const res = await fetch("/admin/catalog/ai/generate-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
    });
    return res.json();
};

export const generateProductSeoMeta = async (
    productId: string
): Promise<{ meta_title: string; meta_description: string | null }> => {
    const res = await fetch("/admin/catalog/ai/generate-seo-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId }),
    });
    return res.json();
};

export interface CakeOptionEntry {
    id: string;
    product_id: string;
    option_type: string;
    values: string[];
    price_delta: number;
}

// ── Cake Options ─────────────────────────────────────────────────────────────

export const useCakeOptions = (productId?: string) => {
    const [data, setData] = useState<{ cake_options: CakeOptionEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCakeOptions = async () => {
            try {
                const url = "/admin/catalog/cake-options" + (productId ? `?product_id=${productId}` : "");
                const res = await fetch(url);
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching cake options", error);
            } finally {
                setLoading(false);
            }
        };
        fetchCakeOptions();
    }, [productId]);

    return { data, loading };
};

export const upsertCakeOption = async (input: { product_id: string; option_type: string; values: string[]; price_delta?: number }) => {
    const res = await fetch("/admin/catalog/cake-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const deleteCakeOption = async (id: string) => {
    const res = await fetch(`/admin/catalog/cake-options/${id}`, { method: "DELETE" });
    return res.json();
};

export interface DeliveryZoneEntry {
    id: string;
    pincode: string;
    branch_id: string;
    delivery_fee: number;
    is_serviceable: boolean;
}

export const useDeliveryZones = () => {
    const [data, setData] = useState<{ delivery_zones: DeliveryZoneEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchZones = async () => {
            try {
                const res = await fetch("/admin/delivery/zones");
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching delivery zones", error);
            } finally {
                setLoading(false);
            }
        };
        fetchZones();
    }, []);

    return { data, loading };
};

export const upsertDeliveryZone = async (input: { pincode: string; branch_id: string; delivery_fee: number; is_serviceable: boolean }) => {
    const res = await fetch("/admin/delivery/zones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const deleteDeliveryZone = async (id: string) => {
    const res = await fetch(`/admin/delivery/zones/${id}`, { method: "DELETE" });
    return res.json();
};

export interface DeliverySlotEntry {
    id: string;
    branch_id: string;
    slot_name: string;
    start_time: string;
    end_time: string;
    max_capacity: number;
    extra_charge: number;
}

export const useDeliverySlots = () => {
    const [data, setData] = useState<{ delivery_slots: DeliverySlotEntry[] } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSlots = async () => {
            try {
                const res = await fetch("/admin/delivery/slots");
                const result = await res.json();
                setData(result);
            } catch (error) {
                console.error("Error fetching delivery slots", error);
            } finally {
                setLoading(false);
            }
        };
        fetchSlots();
    }, []);

    return { data, loading };
};

export const upsertDeliverySlot = async (input: { branch_id: string; slot_name: string; start_time: string; end_time: string; max_capacity: number; extra_charge: number }) => {
    const res = await fetch("/admin/delivery/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const deleteDeliverySlot = async (id: string) => {
    const res = await fetch(`/admin/delivery/slots/${id}`, { method: "DELETE" });
    return res.json();
};


