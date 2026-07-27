"use client";

import { useState } from "react";
import { Button, Input, Label, Text, Badge } from "@medusajs/ui";
import {
    createAddressAction,
    deleteAddressAction,
} from "@frontend/lib/actions";
import type {
    CustomerAddress,
    AddressInput,
} from "@frontend/lib/data/customer";

export function AddressManager({
    addresses: initialAddresses,
}: {
    addresses: CustomerAddress[];
}) {
    const [addresses, setAddresses] = useState<CustomerAddress[]>(initialAddresses);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [form, setForm] = useState<AddressInput>({
        label: "Home",
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        phone: "",
        is_default_shipping: false,
        is_default_billing: false,
    });

    function update<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
        setForm((f) => ({ ...f, [key]: value }));
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        if (!form.line1 || !form.city) {
            setError("Address line and city are required.");
            return;
        }
        setLoading(true);
        try {
            const created = await createAddressAction(form);
            setAddresses((a) => [...a, created]);
            setShowForm(false);
            setForm({
                label: "Home",
                line1: "",
                line2: "",
                city: "",
                state: "",
                pincode: "",
                phone: "",
                is_default_shipping: false,
                is_default_billing: false,
            });
        } catch {
            setError("Could not save address.");
        } finally {
            setLoading(false);
        }
    }

    async function handleDelete(id: string) {
        setLoading(true);
        try {
            await deleteAddressAction(id);
            setAddresses((a) => a.filter((x) => x.id !== id));
        } catch {
            setError("Could not delete address.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
                <Text className="text-ui-fg-subtle">
                    {addresses.length} saved address{addresses.length === 1 ? "" : "es"}
                </Text>
                <Button
                    variant={showForm ? "transparent" : "secondary"}
                    size="small"
                    onClick={() => setShowForm((s) => !s)}
                >
                    {showForm ? "Cancel" : "Add address"}
                </Button>
            </div>

            {error && (
                <Badge className="justify-center text-center" color="red">
                    {error}
                </Badge>
            )}

            {showForm && (
                <form
                    onSubmit={handleCreate}
                    className="flex flex-col gap-3 border rounded p-4"
                >
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <Label htmlFor="label">Label</Label>
                            <Input
                                id="label"
                                value={form.label ?? ""}
                                onChange={(e) => update("label", e.target.value)}
                                placeholder="Home / Office"
                            />
                        </div>
                        <div>
                            <Label htmlFor="phone">Phone</Label>
                            <Input
                                id="phone"
                                value={form.phone ?? ""}
                                onChange={(e) => update("phone", e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="line1">Address Line 1</Label>
                        <Input
                            id="line1"
                            value={form.line1}
                            onChange={(e) => update("line1", e.target.value)}
                            required
                        />
                    </div>
                    <div>
                        <Label htmlFor="line2">Address Line 2</Label>
                        <Input
                            id="line2"
                            value={form.line2 ?? ""}
                            onChange={(e) => update("line2", e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <Label htmlFor="city">City</Label>
                            <Input
                                id="city"
                                value={form.city}
                                onChange={(e) => update("city", e.target.value)}
                                required
                            />
                        </div>
                        <div>
                            <Label htmlFor="state">State</Label>
                            <Input
                                id="state"
                                value={form.state ?? ""}
                                onChange={(e) => update("state", e.target.value)}
                            />
                        </div>
                        <div>
                            <Label htmlFor="pincode">Pincode</Label>
                            <Input
                                id="pincode"
                                value={form.pincode ?? ""}
                                onChange={(e) => update("pincode", e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={!!form.is_default_shipping}
                                onChange={(e) =>
                                    update("is_default_shipping", e.target.checked)
                                }
                            />
                            Default shipping
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={!!form.is_default_billing}
                                onChange={(e) =>
                                    update("is_default_billing", e.target.checked)
                                }
                            />
                            Default billing
                        </label>
                    </div>
                    <Button type="submit" size="large" isLoading={loading}>
                        Save address
                    </Button>
                </form>
            )}

            <div className="flex flex-col gap-3">
                {addresses.length === 0 && !showForm && (
                    <Text className="text-ui-fg-subtle">
                        No saved addresses yet.
                    </Text>
                )}
                {addresses.map((addr) => (
                    <div
                        key={addr.id}
                        className="border rounded p-4 flex justify-between items-start"
                    >
                        <div className="flex flex-col gap-1">
                            <Text className="font-medium">
                                {addr.label ?? "Address"}{" "}
                                {addr.is_default_shipping && (
                                    <Badge size="small" color="green">
                                        Default
                                    </Badge>
                                )}
                            </Text>
                            <Text className="text-ui-fg-subtle text-sm">
                                {addr.line1}
                                {addr.line2 ? `, ${addr.line2}` : ""}
                            </Text>
                            <Text className="text-ui-fg-subtle text-sm">
                                {addr.city}
                                {addr.state ? `, ${addr.state}` : ""}{" "}
                                {addr.pincode ?? ""}
                            </Text>
                            {addr.phone && (
                                <Text className="text-ui-fg-subtle text-sm">
                                    {addr.phone}
                                </Text>
                            )}
                        </div>
                        <Button
                            variant="danger"
                            size="small"
                            onClick={() => handleDelete(addr.id)}
                            disabled={loading}
                        >
                            Delete
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
