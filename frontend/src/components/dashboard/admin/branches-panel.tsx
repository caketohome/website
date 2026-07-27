"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, StatusBadge, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Plus, Store, MapPin, Building } from "lucide-react";

export function BranchesPanel() {
  const [branches, setBranches] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Bangalore");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchBranches = () => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminBranches().then((r: any) => setBranches(r?.branches || r?.data || [])).catch(() => null),
      apiClient.getAdminCities().then((r: any) => setCities(r?.cities || r?.data || [])).catch(() => null),
      apiClient.getAdminRegions().then((r: any) => setRegions(r?.regions || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newBranch = {
      id: `shop_${Date.now()}`,
      name,
      address,
      city,
      phone,
      is_open: true,
      created_at: new Date().toISOString(),
    };

    await apiClient.createAdminBranch(newBranch);
    setBranches((prev) => [newBranch, ...prev]);
    setSuccessMsg(`Successfully created branch "${name}"!`);
    setName("");
    setAddress("");
    setPhone("");
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Branch & Shop Management</Heading>
          <Text className="text-ui-fg-subtle text-sm">Create and manage bakery branches, cities, and delivery regions.</Text>
        </div>
        <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white">
          <Plus className="w-4 h-4" /> Create New Shop / Branch
        </Button>
      </div>

      {showCreateModal && (
        <Container className="p-6 border-2 border-amber-500/30 bg-amber-50/20 dark:bg-amber-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="w-5 h-5 text-amber-600" />
              <Text className="font-semibold text-base">Create New Bakery Branch / Shop</Text>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleCreateBranch} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="branch_name">Branch / Shop Name</Label>
              <Input
                id="branch_name"
                placeholder="e.g. Indiranagar Cake Studio"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="branch_city">City</Label>
              <Input
                id="branch_city"
                placeholder="Bangalore"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="branch_address">Full Street Address</Label>
              <Input
                id="branch_address"
                placeholder="100 Feet Rd, Indiranagar"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="branch_phone">Contact Phone</Label>
              <Input
                id="branch_phone"
                placeholder="+91 98765 00000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-amber-600 hover:bg-amber-700 text-white">
                Save & Deploy Branch
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
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading branches...</Text></Container>
      ) : (
        <>
          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Bakery Branches ({branches.length})</Text>
            {branches.length === 0 ? (
              <Text className="text-sm text-ui-fg-muted">No branches configured. Click &quot;Create New Shop / Branch&quot; above to add your first shop.</Text>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {branches.map((b: any, i: number) => (
                  <div key={b.id || i} className="p-4 bg-ui-bg-subtle border rounded-lg flex flex-col gap-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <Text className="font-semibold text-sm">{b.name || `Branch #${i + 1}`}</Text>
                      <StatusBadge color={b.is_open !== false ? "green" : "red"} className="text-[10px]">
                        {b.is_open !== false ? "Open" : "Closed"}
                      </StatusBadge>
                    </div>
                    <Text className="text-xs text-ui-fg-muted flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {b.address || b.location || "Bangalore Main Branch"}
                    </Text>
                    {b.phone && <Text className="text-[11px] text-ui-fg-subtle">📞 {b.phone}</Text>}
                  </div>
                ))}
              </div>
            )}
          </Container>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Container className="p-5">
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Cities Covered ({cities.length})</Text>
              <div className="flex flex-wrap gap-2">
                {(cities.length > 0 ? cities : [{ name: "Bangalore" }, { name: "Mumbai" }, { name: "Delhi NCR" }]).map((c: any, i: number) => (
                  <Badge key={i} color="blue">{c.name || `City #${i + 1}`}</Badge>
                ))}
              </div>
            </Container>
            <Container className="p-5">
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Delivery Zones ({regions.length})</Text>
              <div className="flex flex-wrap gap-2">
                {(regions.length > 0 ? regions : [{ name: "Koramangala Zone 1" }, { name: "Indiranagar Zone 2" }, { name: "HSR Layout Zone 3" }]).map((r: any, i: number) => (
                  <Badge key={i} color="green">{r.name || `Region #${i + 1}`}</Badge>
                ))}
              </div>
            </Container>
          </div>
        </>
      )}
    </div>
  );
}
