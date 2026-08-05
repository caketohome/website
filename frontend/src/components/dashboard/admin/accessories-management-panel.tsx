"use client";

import { useState, useEffect } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Search, Plus, Trash2, Edit3, Gift, Package, AlertTriangle, CheckCircle } from "lucide-react";
import Image from "next/image";

export function AccessoriesManagementPanel() {
  const [accessories, setAccessories] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("99");
  const [costPrice, setCostPrice] = useState("40");
  const [mrp, setMrp] = useState("149");
  const [stock, setStock] = useState("50");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [gstRate, setGstRate] = useState("18");
  const [thumbnail, setThumbnail] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [occasionTags, setOccasionTags] = useState<string[]>(["birthday"]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAccessories = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminAccessories();
      setAccessories(res?.accessories || []);
      setCategories(res?.categories || []);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccessories();
  }, []);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setName("");
    setSku(`ACC-${Math.floor(1000 + Math.random() * 9000)}`);
    setBarcode(`890${Math.floor(100000000 + Math.random() * 900000000)}`);
    setCategoryId(categories[0]?.id || "cat_acc_cake");
    setPrice("99");
    setCostPrice("40");
    setMrp("149");
    setStock("50");
    setLowStockThreshold("5");
    setGstRate("18");
    setThumbnail("https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=400");
    setDescription("Premium celebration accessory.");
    setStatus("active");
    setShowModal(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setSku(item.sku || "");
    setBarcode(item.barcode || "");
    setCategoryId(item.category_id || "");
    setPrice(String(item.price || 99));
    setCostPrice(String(item.cost_price || 40));
    setMrp(String(item.mrp || 149));
    setStock(String(item.stock ?? 50));
    setLowStockThreshold(String(item.low_stock_threshold || 5));
    setGstRate(String(item.gst_rate || 18));
    setThumbnail(item.thumbnail || "");
    setDescription(item.description || "");
    setStatus(item.status || "active");
    setShowModal(true);
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to delete accessory "${itemName}"?`)) return;
    try {
      await apiClient.deleteAdminAccessory(id);
      fetchAccessories();
    } catch (e: any) {
      alert(e.message || "Failed to delete accessory");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);

    const catObj = categories.find((c) => c.id === categoryId);

    const payload = {
      id: editingItem?.id,
      sku,
      barcode,
      name,
      category_id: categoryId,
      category_name: catObj?.name || "Cake Accessories",
      price: parseFloat(price) || 0,
      cost_price: parseFloat(costPrice) || 0,
      mrp: parseFloat(mrp) || 0,
      stock: parseInt(stock, 10) || 0,
      low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,
      gst_rate: parseFloat(gstRate) || 18,
      thumbnail,
      images: [thumbnail],
      description,
      status,
    };

    try {
      if (editingItem?.id) {
        await apiClient.updateAdminAccessory(editingItem.id, payload);
      } else {
        await apiClient.createAdminAccessory(payload);
      }
      setShowModal(false);
      fetchAccessories();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save accessory");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = accessories.filter((a) => {
    const matchesSearch = a.name?.toLowerCase().includes(search.toLowerCase()) || a.sku?.toLowerCase().includes(search.toLowerCase());
    const matchesCat = categoryFilter === "all" || a.category_id === categoryFilter;
    return matchesSearch && matchesCat;
  });

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <Heading level="h2" className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Gift className="w-5 h-5 text-rose-500" /> Accessory & Gift Catalog Management ({filtered.length})
          </Heading>
          <Text className="text-xs text-slate-600 dark:text-slate-400">
            Inventory-driven accessories, toppers, greeting cards, flowers, plush toys, and gift hampers. Out-of-stock items hide automatically.
          </Text>
        </div>

        <Button onClick={handleOpenCreate} className="bg-rose-600 hover:bg-rose-700 text-white font-bold shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Add Accessory Product
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <Input
            placeholder="Search accessory name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-xs font-semibold p-2.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900"
        >
          <option value="all">All Accessory Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {/* Table Catalog */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-600 dark:text-slate-400 border-b">
              <tr>
                <th className="p-3">Accessory Item</th>
                <th className="p-3">Category</th>
                <th className="p-3">Price & Cost</th>
                <th className="p-3">Stock Level</th>
                <th className="p-3">GST Rate</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">Loading accessory catalog...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400">No accessories found matching filters.</td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const stockNum = Number(item.stock || 0);
                  const isOut = stockNum === 0;
                  const isLow = stockNum > 0 && stockNum <= Number(item.low_stock_threshold || 5);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden border bg-slate-100 shrink-0">
                            {item.thumbnail ? (
                              <Image src={item.thumbnail} alt={item.name} fill className="object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400 m-auto mt-2" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{item.name}</span>
                            <span className="text-[10px] text-slate-500">SKU: {item.sku}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                        {item.category_name || "Cake Accessories"}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-bold text-rose-600">₹{item.price}</span>
                          <span className="text-[10px] text-slate-400">Cost: ₹{item.cost_price || 0} (MRP: ₹{item.mrp || item.price})</span>
                        </div>
                      </td>
                      <td className="p-3">
                        {isOut ? (
                          <span className="px-2 py-0.5 rounded font-extrabold text-[10px] bg-rose-100 text-rose-700 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> OUT OF STOCK (0)
                          </span>
                        ) : isLow ? (
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-amber-100 text-amber-800 flex items-center gap-1 w-fit">
                            <AlertTriangle className="w-3 h-3" /> LOW STOCK ({stockNum})
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800 flex items-center gap-1 w-fit">
                            <CheckCircle className="w-3 h-3" /> In Stock ({stockNum})
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-medium text-slate-600">{item.gst_rate || 18}% GST</td>
                      <td className="p-3">
                        <Badge color={item.status === "active" ? "green" : "red"}>
                          {item.status === "active" ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="small" variant="transparent" onClick={() => handleOpenEdit(item)}>
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                          </Button>
                          <Button size="small" variant="transparent" onClick={() => handleDelete(item.id, item.name)}>
                            <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col my-8">
            <div className="p-5 border-b flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Gift className="w-5 h-5 text-rose-500" />
                {editingItem ? `Edit Accessory: ${editingItem.name}` : "Create Accessory Product"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            {errorMsg && (
              <div className="mx-5 mt-4 p-3 bg-rose-100 text-rose-800 text-xs font-semibold rounded-lg">
                ⚠️ {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[75vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Accessory Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold Acrylic Topper" required />
                </div>
                <div>
                  <Label>Category *</Label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label>SKU Code</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
                <div>
                  <Label>Barcode (EAN/UPC)</Label>
                  <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
                </div>

                <div>
                  <Label>Selling Price (₹) *</Label>
                  <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} required />
                </div>
                <div>
                  <Label>Cost Price (₹)</Label>
                  <Input type="number" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                </div>
                <div>
                  <Label>MRP (₹)</Label>
                  <Input type="number" value={mrp} onChange={(e) => setMrp(e.target.value)} />
                </div>
                <div>
                  <Label>GST Tax Rate (%)</Label>
                  <Input type="number" value={gstRate} onChange={(e) => setGstRate(e.target.value)} />
                </div>

                <div>
                  <Label>Stock Quantity *</Label>
                  <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required />
                </div>
                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                </div>

                <div className="sm:col-span-2">
                  <Label>WebP Image URL</Label>
                  <Input value={thumbnail} onChange={(e) => setThumbnail(e.target.value)} placeholder="https://..." />
                </div>
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Accessory details..." />
                </div>

                <div>
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900"
                  >
                    <option value="active">Active (Visible)</option>
                    <option value="inactive">Inactive (Hidden)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                  Save Accessory
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
