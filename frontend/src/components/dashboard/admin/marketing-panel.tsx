"use client";
import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Plus, Tag } from "lucide-react";

export function MarketingPanel() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form State
  const [code, setCode] = useState("");
  const [discountValue, setDiscountValue] = useState("");
  const [discountType, setDiscountType] = useState("percentage");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminCampaigns().then((r: any) => setCampaigns(r?.campaigns || r?.data || [])).catch(() => null),
      apiClient.getAdminOffers().then((r: any) => setOffers(r?.offers || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newOffer = {
      id: `offer_${Date.now()}`,
      code: code.toUpperCase(),
      discount_value: parseFloat(discountValue) || 10,
      discount_type: discountType,
      description,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await apiClient.createAdminOffer(newOffer);
    setOffers((prev) => [newOffer, ...prev]);
    setSuccessMsg(`Successfully created coupon code "${code.toUpperCase()}"!`);
    setCode("");
    setDiscountValue("");
    setDescription("");
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
          <Heading level="h2" className="text-xl">Marketing & Offers</Heading>
          <Text className="text-ui-fg-subtle text-sm">Create and manage promotions, campaigns, and coupon codes.</Text>
        </div>
        <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="w-4 h-4" /> Create New Offer / Coupon
        </Button>
      </div>

      {showCreateModal && (
        <Container className="p-6 border-2 border-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Tag className="w-5 h-5 text-purple-600" />
              <Text className="font-semibold text-base">Create New Offer / Coupon Code</Text>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleCreateOffer} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="offer_code">Coupon Code (e.g. CAKE50)</Label>
              <Input
                id="offer_code"
                placeholder="FESTIVE20"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="discount_val">Discount Amount / %</Label>
              <Input
                id="discount_val"
                type="number"
                placeholder="20"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="offer_desc">Description</Label>
              <Input
                id="offer_desc"
                placeholder="20% off on all artisanal cakes above ₹499"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                Activate Offer Code
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
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading marketing data...</Text></Container>
      ) : (
        <>
          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Active Offers & Coupons ({offers.length})</Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(offers.length > 0 ? offers : [
                { code: "CAKE50", description: "50% Off up to ₹150", is_active: true },
                { code: "WELCOME100", description: "Flat ₹100 Off on First Order", is_active: true },
                { code: "FREEDELIVERY", description: "Free Midnight Delivery", is_active: true },
              ]).map((o: any, i: number) => (
                <div key={o.id || i} className="p-4 bg-ui-bg-subtle border rounded-lg flex flex-col gap-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <Text className="font-mono font-bold text-sm text-purple-700 dark:text-purple-300">{o.code}</Text>
                    <Badge color={o.is_active ? "green" : "red"} className="text-[10px]">{o.is_active ? "Active" : "Expired"}</Badge>
                  </div>
                  <Text className="text-xs text-ui-fg-muted">{o.description || "Special promotional discount"}</Text>
                </div>
              ))}
            </div>
          </Container>

          <Container className="p-5">
            <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-3">Marketing Campaigns ({campaigns.length})</Text>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(campaigns.length > 0 ? campaigns : [
                { name: "Monsoon Festival Special", description: "Special seasonal cake collection push", is_active: true },
                { name: "Birthday Surprise Rewards", description: "Automated birthday notification discounts", is_active: true },
              ]).map((c: any, i: number) => (
                <div key={c.id || i} className="p-4 bg-ui-bg-subtle border rounded-lg flex flex-col gap-2">
                  <Text className="font-semibold text-sm">{c.name || c.title}</Text>
                  <Text className="text-xs text-ui-fg-muted">{c.description}</Text>
                  <Badge color={c.is_active ? "green" : "grey"} className="w-fit text-[10px]">{c.is_active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          </Container>
        </>
      )}
    </div>
  );
}
