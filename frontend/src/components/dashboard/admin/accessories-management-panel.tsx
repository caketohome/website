"use client";

import React, { useState, useEffect, useRef } from "react";
import { Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { compressImageToWebP } from "@frontend/lib/util/image-compressor";
import { Search, Plus, Trash2, Edit3, Gift, Package, AlertTriangle, CheckCircle, Upload, Image as ImageIcon, X, RefreshCw, Calculator, FileText } from "lucide-react";

// Platform Authoritative Tax Categories Configuration
const TAX_CATEGORIES = [
  { id: "cat_tax_candles", name: "Sparklers & Birthday Candles", hsn: "34060010", rate: 18 },
  { id: "cat_tax_balloons", name: "Balloons & Party Decor", hsn: "95059000", rate: 18 },
  { id: "cat_tax_cards", name: "Greeting Cards & Stationery", hsn: "49090090", rate: 12 },
  { id: "cat_tax_cake", name: "Bakery & Edible Toppers", hsn: "19059090", rate: 5 },
  { id: "cat_tax_custom", name: "Custom Tax Classification", hsn: "99990000", rate: 18 },
];

function AccessoryTableRowImage({ src, alt }: { src?: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
        <Package className="w-5 h-5 text-slate-400" />
      </div>
    );
  }

  return (
    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 shrink-0">
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover"
        onError={() => setHasError(true)}
      />
    </div>
  );
}

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

  // Tax Engine Form State
  const [taxCategoryId, setTaxCategoryId] = useState("cat_tax_candles");
  const [hsnCode, setHsnCode] = useState("34060010");
  const [gstRate, setGstRate] = useState("18");
  const [taxTreatment, setTaxTreatment] = useState<"inclusive" | "exclusive">("inclusive");

  // Image Upload & Compression State
  const [thumbnail, setThumbnail] = useState("");
  const [compressingImage, setCompressingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageMeta, setImageMeta] = useState<{ dimensions?: string; sizeKb?: number } | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);

  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleTaxCategoryChange = (catId: string) => {
    setTaxCategoryId(catId);
    const matched = TAX_CATEGORIES.find((t) => t.id === catId);
    if (matched && catId !== "cat_tax_custom") {
      setHsnCode(matched.hsn);
      setGstRate(String(matched.rate));
    }
  };

  const handleImageFileSelect = async (file: File) => {
    setImageError(null);
    if (!file) return;

    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type.toLowerCase())) {
      setImageError("Please upload a JPG, PNG, or WebP image.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setImageError("Image is too large. Please choose a smaller file under 10MB.");
      return;
    }

    setCompressingImage(true);
    try {
      const compressedWebP = await compressImageToWebP(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.82,
      });

      setThumbnail(compressedWebP);
      const sizeKb = Math.round((compressedWebP.length * 0.75) / 1024);

      // Measure dimensions
      const img = new Image();
      img.onload = () => {
        setImageMeta({
          dimensions: `${img.width} × ${img.height}`,
          sizeKb,
        });
      };
      img.src = compressedWebP;
    } catch {
      setImageError("Unable to process this image. Please try another file.");
    } finally {
      setCompressingImage(false);
    }
  };

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

    setTaxCategoryId("cat_tax_candles");
    setHsnCode("34060010");
    setGstRate("18");
    setTaxTreatment("inclusive");

    setThumbnail("https://images.unsplash.com/photo-1535141192574-5d4897c13136?auto=format&fit=crop&q=80&w=400");
    setImageMeta(null);
    setImageError(null);
    setShowUrlInput(false);

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

    const matchedTax = TAX_CATEGORIES.find((t) => t.hsn === item.hsn_code || t.rate === item.gst_rate_pct);
    setTaxCategoryId(item.tax_category_id || matchedTax?.id || "cat_tax_candles");
    setHsnCode(item.hsn_code || matchedTax?.hsn || "34060010");
    setGstRate(String(item.gst_rate_pct || item.gst_rate || 18));
    setTaxTreatment(item.tax_treatment || "inclusive");

    setThumbnail(item.thumbnail || "");
    setImageMeta(null);
    setImageError(null);
    setShowUrlInput(false);

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
    const parsedPrice = parseFloat(price) || 0;
    const parsedGst = parseFloat(gstRate) || 18;

    const payload = {
      id: editingItem?.id,
      sku,
      barcode,
      name,
      category_id: categoryId,
      category_name: catObj?.name || "Cake Accessories",
      price: parsedPrice,
      cost_price: parseFloat(costPrice) || 0,
      mrp: parseFloat(mrp) || 0,
      stock: parseInt(stock, 10) || 0,
      low_stock_threshold: parseInt(lowStockThreshold, 10) || 5,

      // Authoritative Tax Configuration Payload
      tax_category_id: taxCategoryId,
      hsn_code: hsnCode,
      gst_rate: parsedGst,
      gst_rate_pct: parsedGst,
      tax_treatment: taxTreatment,

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

  // Calculate live tax breakdown
  const numSellingPrice = parseFloat(price) || 0;
  const numGstRate = parseFloat(gstRate) || 0;
  const calculatedTaxable = Math.round((numSellingPrice / (1 + numGstRate / 100)) * 100) / 100;
  const calculatedTax = Math.round((numSellingPrice - calculatedTaxable) * 100) / 100;
  const halfGst = Math.round((calculatedTax / 2) * 100) / 100;

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div>
          <Heading level="h2" className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <Gift className="w-5 h-5 text-rose-500" /> Accessory & Gift Catalog Management ({filtered.length})
          </Heading>
          <Text className="text-xs text-slate-600 dark:text-slate-400">
            Inventory-driven accessories, toppers, cards, and candles configured with platform-authoritative GST tax rules and WebP compression.
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
                <th className="p-3">GST Tax Configuration</th>
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
                  const hsn = item.hsn_code || "34060010";
                  const rate = item.gst_rate_pct || item.gst_rate || 18;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <AccessoryTableRowImage src={item.thumbnail} alt={item.name} />
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
                      <td className="p-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{rate}% GST (Inclusive)</span>
                          <span className="text-[10px] text-slate-400 font-mono">HSN: {hsn}</span>
                        </div>
                      </td>
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
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col my-6">
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

            <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs overflow-y-auto max-h-[80vh]">
              {/* Product Basic Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <Label>Accessory Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Gold Acrylic Topper" required />
                </div>
                <div>
                  <Label>Category *</Label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
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
                  <Label>Stock Quantity *</Label>
                  <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} required />
                </div>
              </div>

              {/* SECTION: PLATFORM TAX ENGINE CONFIGURATION */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                    <Calculator className="w-4 h-4 text-emerald-500" /> Platform Tax Engine Configuration
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Tax Inclusive Rule
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label>Tax Category</Label>
                    <select
                      value={taxCategoryId}
                      onChange={(e) => handleTaxCategoryChange(e.target.value)}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                    >
                      {TAX_CATEGORIES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label>HSN / SAC Code</Label>
                    <Input
                      value={hsnCode}
                      onChange={(e) => setHsnCode(e.target.value)}
                      readOnly={taxCategoryId !== "cat_tax_custom"}
                      className={taxCategoryId !== "cat_tax_custom" ? "bg-slate-100 dark:bg-slate-800 font-mono" : "font-mono"}
                    />
                  </div>

                  <div>
                    <Label>GST Rate (%)</Label>
                    <select
                      value={gstRate}
                      onChange={(e) => setGstRate(e.target.value)}
                      disabled={taxCategoryId !== "cat_tax_custom"}
                      className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 disabled:opacity-75"
                    >
                      <option value="5">5% GST (Bakery / Edible)</option>
                      <option value="12">12% GST (Cards / Stationery)</option>
                      <option value="18">18% GST (Candles / Decor / Services)</option>
                      <option value="28">28% GST (Luxury Decor)</option>
                    </select>
                  </div>
                </div>

                {/* Live Tax Breakdown Summary */}
                <div className="p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Selling Price</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{numSellingPrice.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Taxable Amount</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">₹{calculatedTaxable.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CGST ({numGstRate / 2}%) + SGST</span>
                    <span className="font-bold text-emerald-600">₹{halfGst.toFixed(2)} × 2</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Tax (GST)</span>
                    <span className="font-bold text-rose-600">₹{calculatedTax.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* SECTION: PRODUCT IMAGE UPLOADER & WEBP COMPRESSION */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-blue-500" /> Product Image
                  </Label>
                  <button
                    type="button"
                    onClick={() => setShowUrlInput(!showUrlInput)}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    {showUrlInput ? "← Switch to Image Uploader" : "Enter Image URL directly"}
                  </button>
                </div>

                {imageError && (
                  <div className="p-2.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold">
                    ⚠️ {imageError}
                  </div>
                )}

                {showUrlInput ? (
                  <div>
                    <Input
                      value={thumbnail}
                      onChange={(e) => setThumbnail(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Direct image URL input. Formats: WebP, PNG, JPG.
                    </span>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageFileSelect(file);
                      }}
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                    />

                    {thumbnail ? (
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                        <div className="relative w-20 h-20 rounded-lg overflow-hidden border bg-white dark:bg-slate-900 shrink-0">
                          <img src={thumbnail} alt="Accessory Preview" className="w-full h-full object-cover" />
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">Product Photo</span>
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-extrabold text-[10px] rounded">
                              WebP Compressed
                            </span>
                          </div>
                          {imageMeta && (
                            <p className="text-[11px] text-slate-500">
                              Dimensions: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{imageMeta.dimensions}</span> • Size: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{imageMeta.sizeKb} KB</span>
                            </p>
                          )}
                          <div className="flex items-center gap-2 pt-1">
                            <Button
                              type="button"
                              size="small"
                              variant="secondary"
                              onClick={() => fileInputRef.current?.click()}
                              isLoading={compressingImage}
                            >
                              <RefreshCw className="w-3 h-3 mr-1" /> Replace Image
                            </Button>
                            <Button
                              type="button"
                              size="small"
                              variant="transparent"
                              className="text-rose-600 hover:text-rose-700"
                              onClick={() => {
                                setThumbnail("");
                                setImageMeta(null);
                              }}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const file = e.dataTransfer.files?.[0];
                          if (file) handleImageFileSelect(file);
                        }}
                        className="p-8 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 rounded-xl bg-slate-50/50 dark:bg-slate-800/20 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2"
                      >
                        {compressingImage ? (
                          <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                            <RefreshCw className="w-4 h-4 animate-spin" /> Auto-Compressing to WebP format...
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-rose-500" />
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                                Click or drag an image here to upload
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                Supports JPG, PNG, WebP (Auto-compressed & resized to max 1200px)
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Description & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Accessory details..." />
                </div>

                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} />
                </div>

                <div>
                  <Label>Status</Label>
                  <select
                    value={status}
                    onChange={(e: any) => setStatus(e.target.value)}
                    className="w-full p-2.5 text-xs font-semibold rounded-lg border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                  >
                    <option value="active">Active (Visible in Storefront)</option>
                    <option value="inactive">Inactive (Hidden from Storefront)</option>
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
