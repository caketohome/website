"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Plus, Cake } from "lucide-react";

export function CatalogPanel() {
  const [products, setProducts] = useState<any[]>([]);
  const [options, setOptions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"products" | "options">("products");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Artisanal Cakes");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminProducts().then((r: any) => setProducts(r?.products || r?.data || [])).catch(() => null),
      apiClient.getAdminCakeOptions().then((r: any) => setOptions(r?.options || r?.data || [])).catch(() => null),
    ]).finally(() => setLoading(false));
  }, []);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    const newProd = {
      id: `prod_${Date.now()}`,
      name,
      price: parseFloat(price) || 599,
      category,
      description,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    await apiClient.createAdminProduct(newProd);
    setProducts((prev) => [newProd, ...prev]);
    setSuccessMsg(`Successfully created product "${name}"!`);
    setName("");
    setPrice("");
    setDescription("");
    setSubmitting(false);
    setTimeout(() => {
      setShowCreateModal(false);
      setSuccessMsg(null);
    }, 1500);
  };

  const filtered = (tab === "products" ? products : options).filter((p: any) =>
    JSON.stringify(p).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl">Product Catalog & Inventory</Heading>
          <Text className="text-ui-fg-subtle text-sm">Add products, customize cake options, and manage inventory.</Text>
        </div>
        <div className="flex gap-2">
          <Button size="small" onClick={() => setShowCreateModal(true)} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="w-4 h-4" /> Add New Product / Cake
          </Button>
          <Badge color={tab === "products" ? "purple" : "grey"} className="cursor-pointer" onClick={() => setTab("products")}>Products ({products.length})</Badge>
          <Badge color={tab === "options" ? "purple" : "grey"} className="cursor-pointer" onClick={() => setTab("options")}>Cake Options ({options.length})</Badge>
        </div>
      </div>

      {showCreateModal && (
        <Container className="p-6 border-2 border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cake className="w-5 h-5 text-emerald-600" />
              <Text className="font-semibold text-base">Add New Product / Cake to Catalog</Text>
            </div>
            <button onClick={() => setShowCreateModal(false)} className="text-xs text-ui-fg-subtle hover:underline">Close</button>
          </div>

          <form onSubmit={handleCreateProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="prod_name">Cake / Product Name</Label>
              <Input
                id="prod_name"
                placeholder="e.g. Belgian Dark Chocolate Truffle"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="prod_price">Base Price (₹)</Label>
              <Input
                id="prod_price"
                type="number"
                placeholder="799"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="prod_category">Category</Label>
              <Input
                id="prod_category"
                placeholder="Artisanal Cakes"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="prod_desc">Description</Label>
              <Input
                id="prod_desc"
                placeholder="Rich Belgian chocolate layers with fresh ganache"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3 mt-2">
              <Button type="button" variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Publish Product to Storefront
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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
        <Input placeholder="Search catalog..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <Container className="p-8 text-center"><Text className="text-ui-fg-muted">Loading catalog...</Text></Container>
      ) : filtered.length === 0 ? (
        <Container className="p-8 text-center flex flex-col gap-2 items-center">
          <div className="w-12 h-12 rounded-full bg-ui-bg-subtle flex items-center justify-center text-2xl">🍰</div>
          <Text className="text-ui-fg-muted text-sm">No {tab} found. Click &quot;Add New Product / Cake&quot; above to create your first cake.</Text>
        </Container>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.slice(0, 30).map((p: any, i: number) => (
            <Container key={p.id || i} className="p-4 flex flex-col gap-2 border hover:shadow-md transition-shadow">
              <Text className="font-semibold text-sm">{p.name || p.title || `Item #${i + 1}`}</Text>
              <Text className="text-xs text-ui-fg-subtle line-clamp-2">{p.description || "Freshly baked gourmet cake with premium ingredients"}</Text>
              <div className="flex items-center justify-between mt-auto pt-2">
                <Text className="text-sm font-bold text-emerald-600">₹{p.price || p.amount || "599"}</Text>
                <Badge color={p.is_active !== false ? "green" : "red"} className="text-[10px]">
                  {p.is_active !== false ? "Active" : "Inactive"}
                </Badge>
              </div>
              {p.category && <Badge color="blue" className="w-fit text-[10px]">{p.category}</Badge>}
            </Container>
          ))}
        </div>
      )}
    </div>
  );
}
