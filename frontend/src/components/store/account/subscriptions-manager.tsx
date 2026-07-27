"use client";

import { useState } from "react";
import { Button, Text, Heading, Badge, StatusBadge } from "@medusajs/ui";
import {
    pauseSubscriptionAction,
    resumeSubscriptionAction,
    cancelSubscriptionAction,
} from "@frontend/lib/actions";
import type {
    Subscription,
} from "@frontend/lib/data/catalog";

interface SubscriptionInfo extends Subscription {
    product_title: string;
    thumbnail?: string | null;
}

export function SubscriptionsManager({
    initialSubscriptions,
}: {
    initialSubscriptions: SubscriptionInfo[];
}) {
    const [subs, setSubs] = useState<SubscriptionInfo[]>(initialSubscriptions);
    const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

    const handleAction = async (id: string, actionType: "pause" | "resume" | "cancel") => {
        setActionLoadingMap((prev) => ({ ...prev, [id]: true }));
        try {
            if (actionType === "pause") {
                await pauseSubscriptionAction(id);
                setSubs((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, status: "PAUSED" } : s))
                );
            } else if (actionType === "resume") {
                await resumeSubscriptionAction(id);
                setSubs((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, status: "ACTIVE" } : s))
                );
            } else if (actionType === "cancel") {
                await cancelSubscriptionAction(id);
                setSubs((prev) =>
                    prev.map((s) => (s.id === id ? { ...s, status: "CANCELLED" } : s))
                );
            }
        } catch (e) {
            console.error(`Failed to perform action ${actionType} on subscription ${id}`, e);
        } finally {
            setActionLoadingMap((prev) => ({ ...prev, [id]: false }));
        }
    };

    if (subs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed rounded-lg bg-ui-bg-subtle">
                <Text className="text-ui-fg-muted">You have no active bakery subscriptions.</Text>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            {subs.map((s) => (
                <div key={s.id} className="border border-ui-border-base rounded-lg p-4 bg-ui-bg-base flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex gap-4 items-center">
                        {s.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.thumbnail} alt={s.product_title} className="w-12 h-12 object-cover rounded" />
                        ) : (
                            <div className="w-12 h-12 bg-ui-bg-hover rounded flex items-center justify-center text-lg">🍰</div>
                        )}
                        <div className="flex flex-col gap-1">
                            <Heading level="h3" className="text-sm font-semibold">{s.product_title}</Heading>
                            <div className="flex items-center gap-2">
                                <Badge size="small">{s.frequency}</Badge>
                                <Text className="text-xs text-ui-fg-subtle">Quantity: {s.quantity ?? 1}</Text>
                                <Text className="text-xs text-ui-fg-subtle">Next Order: {new Date(s.next_date || s.next_delivery_date || Date.now()).toLocaleDateString()}</Text>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <StatusBadge color={s.status === "ACTIVE" || s.status === "active" ? "green" : s.status === "PAUSED" || s.status === "paused" ? "orange" : "red"}>
                            {s.status}
                        </StatusBadge>
                        <div className="flex gap-2">
                            {(s.status === "ACTIVE" || s.status === "active") && (
                                <>
                                    <Button 
                                        size="small" 
                                        variant="secondary"
                                        onClick={() => handleAction(s.id, "pause")}
                                        isLoading={actionLoadingMap[s.id]}
                                    >
                                        Pause
                                    </Button>
                                    <Button 
                                        size="small" 
                                        variant="transparent"
                                        onClick={() => handleAction(s.id, "cancel")}
                                        isLoading={actionLoadingMap[s.id]}
                                        className="text-ui-fg-red"
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                            {(s.status === "PAUSED" || s.status === "paused") && (
                                <>
                                    <Button 
                                        size="small" 
                                        variant="secondary"
                                        onClick={() => handleAction(s.id, "resume")}
                                        isLoading={actionLoadingMap[s.id]}
                                    >
                                        Resume
                                    </Button>
                                    <Button 
                                        size="small" 
                                        variant="transparent"
                                        onClick={() => handleAction(s.id, "cancel")}
                                        isLoading={actionLoadingMap[s.id]}
                                        className="text-ui-fg-red"
                                    >
                                        Cancel
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
