"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search } from "lucide-react";

export function CrmPanel() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiClient.getAdminCustomers().then((r: any) => {
      setCustomers(r?.customers || r?.data || []);
    }).catch(() => setCustomers([])).finally(() => setLoading(false));
  }, []);

  const filtered = customers.filter((c: any) =>
    JSON.stringify(c).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Customer CRM</Heading>
          <Text className="text-ui-fg-subtle text-sm">Manage customer accounts and communication.</Text>
        </div>
        <Badge color="purple">{customers.length} customers</Badge>
      </div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
        <Input placeholder="Search customers..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>
      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading customers...</Text></Container>
      ) : filtered.length === 0 ? (
        <Container className="p-8 text-center flex flex-col gap-2 items-center">
          <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center text-2xl">👤</div>
          <Text className="text-ui-fg-muted text-sm">No customers found.</Text>
        </Container>
      ) : (
        <Container className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-ui-bg-subtle">
              <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">ID</th>
              <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Name</th>
              <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Phone</th>
              <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Email</th>
              <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Orders</th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 50).map((c: any, i: number) => (
                <tr key={c.id || i} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                  <td className="p-3 font-mono text-xs">{c.id || `CUS-${i + 1}`}</td>
                  <td className="p-3 text-xs">{c.name || c.first_name || "—"}</td>
                  <td className="p-3 text-xs">{c.phone || "—"}</td>
                  <td className="p-3 text-xs">{c.email || "—"}</td>
                  <td className="p-3 text-xs">{c.order_count || c.total_orders || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      )}
    </div>
  );
}
