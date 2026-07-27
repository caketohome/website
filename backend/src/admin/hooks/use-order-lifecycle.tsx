import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

export interface OrderLifecycleSummary {
    order_id: string;
    status: string;
    current_status_since: string | null;
    display_number: string | null;
    total_amount: number | null;
    currency_code: string | null;
    placed_at: string | null;
    item_count: number | null;
    delivery_date: string | null;
    delivery_slot_id: string | null;
}

export interface TimelineEntry {
    id: string;
    type: "status" | "event" | "note" | "refund" | "reschedule" | "proof" | "assignment";
    timestamp: string;
    title: string;
    description?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    is_customer_visible: boolean;
    metadata?: Record<string, unknown> | null;
}

export interface OrderNoteEntry {
    id: string;
    order_id: string;
    note_type: "internal" | "customer";
    author_type?: string | null;
    author_id?: string | null;
    body: string;
    created_at?: string;
}

export interface RefundEntry {
    id: string;
    order_id: string;
    amount: number;
    refund_channel: string;
    reason_code?: string | null;
    reason?: string | null;
    actor_type?: string | null;
    actor_id?: string | null;
    provider_refund_id?: string | null;
    status: string;
    created_at?: string;
}

export interface RescheduleRequestEntry {
    id: string;
    order_id: string;
    requested_by_type?: string | null;
    requested_by_id?: string | null;
    requested_date?: string | null;
    requested_slot_id?: string | null;
    reason?: string | null;
    status: string;
    resolved_by_type?: string | null;
    resolved_by_id?: string | null;
    resolved_at?: string | null;
    resolution_note?: string | null;
    created_at?: string;
}

export interface DeliveryProofEntry {
    id: string;
    order_id: string;
    delivery_id?: string | null;
    delivery_partner_id?: string | null;
    photo_url?: string | null;
    signature_url?: string | null;
    note?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    captured_at: string;
}

export interface StaffAssignmentEntry {
    id: string;
    order_id: string;
    role: string;
    staff_id: string;
    staff_name?: string | null;
    assigned_by_type?: string | null;
    assigned_by_id?: string | null;
    is_active: boolean;
    created_at?: string;
}

export interface OrderLifecycleDetail {
    id: string;
    display_id?: string;
    status: string;
    lifecycle_status: string;
    current_status_since: string | null;
    status_history: Record<string, unknown>[];
    timeline: TimelineEntry[];
    delivery_proofs: DeliveryProofEntry[];
    refunds: RefundEntry[];
    reschedule_requests: RescheduleRequestEntry[];
    staff_assignments: StaffAssignmentEntry[];
    notes: OrderNoteEntry[];
    total?: number;
    currency_code?: string;
    email?: string;
    created_at?: string;
}

// ── Order List ──────────────────────────────────────────────────────────────

export const useOrderLifecycleList = (status?: string, limit = 50, offset = 0) => {
    const [data, setData] = useState<{ orders: OrderLifecycleSummary[]; count: number } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchList = async () => {
            try {
                const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
                if (status) params.set("status", status);
                const res = await fetch(`/admin/order-lifecycle?${params.toString()}`);
                const result = await res.json();
                setData({ orders: result.orders ?? [], count: result.count ?? 0 });
            } catch (error) {
                console.error("Error fetching order lifecycle list", error);
            } finally {
                setLoading(false);
            }
        };
        fetchList();
    }, [status, limit, offset]);

    return { data, loading };
};

// ── Order Detail ────────────────────────────────────────────────────────────

export const useOrderLifecycleDetail = (orderId?: string) => {
    const [data, setData] = useState<OrderLifecycleDetail | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        if (!orderId) return;
        try {
            const res = await fetch(`/admin/order-lifecycle/${orderId}`);
            const result = await res.json();
            setData(result.order);
        } catch (error) {
            console.error("Error fetching order lifecycle detail", error);
        } finally {
            setLoading(false);
        }
    }, [orderId]);

    useEffect(() => {
        refetch();
    }, [refetch]);

    return { data, loading, refetch };
};

// ── Mutations ───────────────────────────────────────────────────────────────

export const transitionOrderStatus = async (
    orderId: string,
    toStatus: string,
    reason?: string
) => {
    const res = await fetch(`/admin/order-lifecycle/${orderId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to_status: toStatus, reason }),
    });
    return res.json();
};

export const addOrderNote = async (
    orderId: string,
    noteType: "internal" | "customer",
    body: string
) => {
    const res = await fetch(`/admin/order-lifecycle/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_type: noteType, body }),
    });
    return res.json();
};

export const issueRefund = async (
    orderId: string,
    input: {
        amount: number;
        refund_channel?: "payment_provider" | "wallet" | "mixed";
        reason_code?: string;
        reason?: string;
        provider_refund_id?: string;
    }
) => {
    const res = await fetch(`/admin/order-lifecycle/${orderId}/refunds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};

export const resolveRescheduleRequest = async (
    orderId: string,
    requestId: string,
    status: "approved" | "rejected",
    resolutionNote?: string
) => {
    const res = await fetch(
        `/admin/order-lifecycle/${orderId}/reschedule/${requestId}/resolve`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status, resolution_note: resolutionNote }),
        }
    );
    return res.json();
};

export const assignStaff = async (
    orderId: string,
    role: string,
    staffId: string,
    staffName?: string
) => {
    const res = await fetch(`/admin/order-lifecycle/${orderId}/assign-staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, staff_id: staffId, staff_name: staffName }),
    });
    return res.json();
};

export const addDeliveryProof = async (
    orderId: string,
    input: {
        delivery_id?: string;
        delivery_partner_id?: string;
        photo_url?: string;
        signature_url?: string;
        note?: string;
        latitude?: number;
        longitude?: number;
    }
) => {
    const res = await fetch(`/admin/order-lifecycle/${orderId}/proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
    });
    return res.json();
};
