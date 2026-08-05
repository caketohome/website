"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Plus, UserPlus, RefreshCw } from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";

export const CrmPanel = memo(function CrmPanel() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isVip, setIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCustomers = useCallback(() => {
    setLoading(true);
    setError(null);
    apiClient
      .getAdminCustomers()
      .then((r: any) => {
        setCustomers(r?.customers || r?.data || []);
      })
      .catch((err) => {
        console.error("[CRM Panel Error] Failed to fetch customers:", err);
        setError(err.message || "Failed to load customer records");
        setCustomers([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newCus = {
      name,
      phone,
      email,
      is_vip: isVip,
    };

    await apiClient.createAdminCustomer(newCus);
    fetchCustomers();
    setSuccessMsg(`Successfully created customer record for "${name}"!`);
    setName("");
    setPhone("");
    setEmail("");
    setIsVip(false);
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
  };

  const filtered = customers.filter((c: any) => {
    if (!c) return false;
    const q = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(q) ||
      (c.email || "").toLowerCase().includes(q) ||
      (c.phone || "").includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Customer Relationship Management (CRM)</Heading>
          <Text className="text-ui-fg-subtle text-sm">View customer profiles, loyalty tiers, and purchase history.</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={fetchCustomers} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            <UserPlus className="w-4 h-4" /> Add Customer Record
          </Button>
          <Badge color="purple">{customers.length} total</Badge>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchCustomers}>Retry Fetch</Button>
        </div>
      )}

      {showCreateModal && (
        <WidgetErrorBoundary moduleName="Create Customer Modal" compact>
          <Container className="p-6 border-2 border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                <Text className="font-semibold text-base">Add New Customer Record</Text>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
            </div>

            <form onSubmit={handleCreateCustomer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cus_name">Full Name</Label>
                <Input
                  id="cus_name"
                  placeholder="e.g. Priya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cus_phone">Mobile Number</Label>
                <Input
                  id="cus_phone"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="cus_email">Email Address</Label>
                <Input
                  id="cus_email"
                  type="email"
                  placeholder="priya@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 mt-6">
                <input
                  type="checkbox"
                  id="cus_vip"
                  checked={isVip}
                  onChange={(e) => setIsVip(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                />
                <Label htmlFor="cus_vip" className="cursor-pointer">Mark as VIP Platinum Customer</Label>
              </div>
              <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
                <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                  Save Customer Profile
                </Button>
              </div>
              {successMsg && (
                <div className="md:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
                  ✓ {successMsg}
                </div>
              )}
            </form>
          </Container>
        </WidgetErrorBoundary>
      )}

      <WidgetErrorBoundary moduleName="CRM Search Bar" compact>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
          <Input
            placeholder="Search customers by name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </WidgetErrorBoundary>

      <WidgetErrorBoundary moduleName="CRM Customer Table" onRetry={fetchCustomers} compact>
        {loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : filtered.length === 0 ? (
          <Container className="p-8 text-center flex flex-col gap-2 items-center">
            <Text className="text-ui-fg-muted text-sm">No customer records found.</Text>
            {customers.length === 0 && (
              <Button size="small" variant="secondary" onClick={fetchCustomers} className="mt-2 text-xs">
                <RefreshCw className="w-3 h-3 mr-1" /> Retry Loading Customers
              </Button>
            )}
          </Container>
        ) : (
          <Container className="p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-ui-bg-subtle">
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Customer Name</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Phone</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Email</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Orders</th>
                  <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Tier</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c: any, i: number) => (
                  <tr key={c?.id || i} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                    <td className="p-3 text-xs font-medium">{c?.name || c?.first_name || `Customer #${i + 1}`}</td>
                    <td className="p-3 text-xs font-mono">{c?.phone || "—"}</td>
                    <td className="p-3 text-xs text-ui-fg-subtle">{c?.email || "—"}</td>
                    <td className="p-3 text-xs font-semibold text-blue-600">{c?.order_count || c?.orders_count || 0}</td>
                    <td className="p-3">
                      <Badge color={c?.is_vip || c?.tier === "VIP" ? "purple" : "grey"} className="text-[10px]">
                        {c?.is_vip || c?.tier === "VIP" ? "👑 VIP Platinum" : "Standard"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Container>
        )}
      </WidgetErrorBoundary>
    </div>
  );
});
