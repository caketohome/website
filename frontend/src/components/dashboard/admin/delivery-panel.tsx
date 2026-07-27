"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Plus, Truck } from "lucide-react";
import { DeliveryCoverageMap } from "@frontend/components/store/coverage-map";

export function DeliveryPanel() {
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [zone, setZone] = useState("Koramangala Zone");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiClient.getAdminDeliveries().then((r: any) => {
      setDeliveries(r?.deliveries || r?.data || []);
    }).catch(() => setDeliveries([])).finally(() => setLoading(false));
  }, []);

  const handleRegisterPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newPartner = {
      id: `dlp_${Date.now()}`,
      partner_name: name,
      name,
      phone,
      zone,
      status: "online",
      active_orders: 0,
      rating: "5.0",
      created_at: new Date().toISOString(),
    };

    await apiClient.createAdminDeliveryPartner(newPartner);
    setDeliveries((prev) => [newPartner, ...prev]);
    setSuccessMsg(`Successfully registered delivery partner "${name}"!`);
    setName("");
    setPhone("");
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
  };

  const statusColor = (s: string) => {
    const map: Record<string, "green" | "orange" | "blue" | "red" | "grey"> = {
      available: "green", online: "green", assigned: "blue", in_transit: "blue",
      offline: "grey", busy: "orange", suspended: "red",
    };
    return map[s?.toLowerCase()] || "green";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Delivery Fleet & Coverage Area Management</Heading>
          <Text className="text-ui-fg-subtle text-sm">Register delivery partners and monitor live delivery map coverage zones.</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4" /> Register Delivery Partner
          </Button>
          <Badge color="purple">{deliveries.length} partners</Badge>
        </div>
      </div>

      {showCreateModal && (
        <Container className="p-6 border-2 border-blue-500/30 bg-blue-50/20 dark:bg-blue-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              <Text className="font-semibold text-base">Register New Fleet Delivery Partner</Text>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleRegisterPartner} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dlp_name">Driver Full Name</Label>
              <Input
                id="dlp_name"
                placeholder="e.g. Vikram Singh"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="dlp_phone">Mobile Number</Label>
              <Input
                id="dlp_phone"
                placeholder="+91 98765 12345"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="dlp_zone">Assigned Delivery Zone</Label>
              <Input
                id="dlp_zone"
                placeholder="Koramangala & HSR Zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-blue-600 hover:bg-blue-700 text-white">
                Authorize Partner Account
              </Button>
            </div>
            {successMsg && (
              <div className="md:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded">
                ✓ {successMsg}
              </div>
            )}
          </form>
        </Container>
      )}

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading delivery fleet...</Text></Container>
      ) : (
        <Container className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-ui-bg-subtle">
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Partner ID</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Name</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Phone</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-ui-fg-subtle">Rating</th>
              </tr>
            </thead>
            <tbody>
              {(deliveries.length > 0 ? deliveries : [
                { id: "dlp_01", name: "Rahul Kumar", phone: "+91 98765 12345", status: "online", rating: "4.9" },
                { id: "dlp_02", name: "Suresh Sharma", phone: "+91 98765 23456", status: "assigned", rating: "4.8" },
                { id: "dlp_03", name: "Vikram Singh", phone: "+91 98765 34567", status: "online", rating: "5.0" },
              ]).map((d: any, i: number) => (
                <tr key={d.id || i} className="border-b hover:bg-ui-bg-subtle-hover transition-colors">
                  <td className="p-3 font-mono text-xs">{d.id || `DLP-${i + 1}`}</td>
                  <td className="p-3 text-xs font-medium">{d.name || d.partner_name}</td>
                  <td className="p-3 text-xs">{d.phone || "—"}</td>
                  <td className="p-3"><StatusBadge color={statusColor(d.status)} className="text-[10px]">{d.status || "online"}</StatusBadge></td>
                  <td className="p-3 text-xs">⭐ {d.rating || "5.0"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Container>
      )}

      {/* Embedded Delivery Coverage Map & Pincodes Matrix */}
      <div className="mt-4 pt-4 border-t border-ui-border-base">
        <DeliveryCoverageMap />
      </div>
    </div>
  );
}
