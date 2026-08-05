"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Sliders, Plus, Edit3, Trash2, RotateCcw, Search, CheckCircle, AlertCircle, Scale, Sparkles, Layers, Gift } from "lucide-react";
import { GridSkeleton } from "./admin-skeletons";

export function VariantsManagementPanel() {
  const [options, setOptions] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<"weight" | "shape" | "flavour" | "filling" | "cream" | "topper" | "addon">("weight");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingOption, setEditingOption] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [weightVal, setWeightVal] = useState("");
  const [unit, setUnit] = useState("kg");
  const [priceModifier, setPriceModifier] = useState("0");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [status, setStatus] = useState("active");
  const [imageUrl, setImageUrl] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchOptions = () => {
    setLoading(true);
    apiClient
      .getAdminVariantOptions()
      .then((r: any) => setOptions(r?.options || r?.data || []))
      .catch(() => null)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchOptions();
  }, []);

  const resetForm = () => {
    setName("");
    setDisplayName("");
    setWeightVal("");
    setUnit("kg");
    setPriceModifier("0");
    setDisplayOrder("1");
    setStatus("active");
    setImageUrl("");
    setEditingOption(null);
    setErrorMsg(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (opt: any) => {
    setEditingOption(opt);
    setName(opt.name || "");
    setDisplayName(opt.display_name || opt.name || "");
    setWeightVal(opt.weight_val ? String(opt.weight_val) : "");
    setUnit(opt.unit || "kg");
    setPriceModifier(String(opt.price_modifier || 0));
    setDisplayOrder(String(opt.display_order || 1));
    setStatus(opt.status || "active");
    setImageUrl(opt.image_url || "");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = {
      type: activeType,
      name,
      display_name: displayName || name,
      weight_val: weightVal ? parseFloat(weightVal) : undefined,
      unit,
      price_modifier: parseFloat(priceModifier) || 0,
      display_order: parseInt(displayOrder, 10) || 1,
      status,
      image_url: imageUrl || undefined,
    };

    try {
      if (editingOption) {
        await apiClient.updateAdminVariantOption(editingOption.id, payload);
        setSuccessMsg(`Updated option "${name}"!`);
      } else {
        await apiClient.createAdminVariantOption(payload);
        setSuccessMsg(`Created option "${name}"!`);
      }
      fetchOptions();
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save variant option.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, optName: string) => {
    if (!confirm(`Are you sure you want to archive option "${optName}"?`)) return;
    try {
      await apiClient.deleteAdminVariantOption(id);
      fetchOptions();
    } catch (err: any) {
      alert(err.message || "Failed to archive option.");
    }
  };

  const filtered = options
    .filter((o) => o.type === activeType)
    .filter((o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.display_name && o.display_name.toLowerCase().includes(search.toLowerCase()))
    );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" /> Master Variant & Dynamic Pricing Configuration
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Centralized Super Admin Master Data: Manage weights, shapes, flavours, fillings, creams, toppers, and price modifiers.
          </Text>
        </div>
        <Button size="small" onClick={handleOpenCreateModal} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="w-4 h-4" /> Add Master {activeType.toUpperCase()} Option
        </Button>
      </div>

      {/* Type Tabs Navigation */}
      <div className="flex border-b border-ui-border-base px-2 gap-2 bg-ui-bg-subtle overflow-x-auto text-xs font-medium rounded-lg p-1">
        <button onClick={() => setActiveType("weight")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "weight" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Weights ({options.filter(o => o.type === "weight").length})
        </button>
        <button onClick={() => setActiveType("shape")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "shape" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Shapes ({options.filter(o => o.type === "shape").length})
        </button>
        <button onClick={() => setActiveType("flavour")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "flavour" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Flavours ({options.filter(o => o.type === "flavour").length})
        </button>
        <button onClick={() => setActiveType("filling")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "filling" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Fillings ({options.filter(o => o.type === "filling").length})
        </button>
        <button onClick={() => setActiveType("cream")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "cream" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Creams ({options.filter(o => o.type === "cream").length})
        </button>
        <button onClick={() => setActiveType("topper")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "topper" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Toppers & Decors ({options.filter(o => o.type === "topper").length})
        </button>
        <button onClick={() => setActiveType("addon")} className={`py-2 px-3 rounded flex items-center gap-1.5 ${activeType === "addon" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}>
          Add-ons ({options.filter(o => o.type === "addon").length})
        </button>
      </div>

      {activeType === "weight" && (
        <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 dark:bg-purple-950/40 dark:border-purple-800 text-xs text-purple-900 dark:text-purple-200 flex items-center gap-2">
          <Scale className="w-5 h-5 text-purple-600 shrink-0" />
          <div>
            <span className="font-bold">Weight Master Data (Pure Size Definitions):</span> Weights define available bakery sizes only (<code className="font-mono font-bold">250g, 500g, 1kg, 2kg</code>). Specific Selling Prices, MRPs, and Cost Prices are configured per product in the <strong>Product-Specific Weight Pricing Matrix Table</strong>.
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <Container className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle" />
          <Input
            placeholder={`Search ${activeType} options...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Container>

      {/* Option Create/Edit Modal */}
      {showModal && (
        <Container className="p-6 border-2 border-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-base">
              {editingOption ? `Edit ${activeType.toUpperCase()} Option "${editingOption.name}"` : `Create Master ${activeType.toUpperCase()} Option`}
            </Text>
            <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
          </div>

          {successMsg && (
            <div className="p-3 mb-4 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-2 text-sm font-medium">
              <CheckCircle className="w-4 h-4" /> {successMsg}
            </div>
          )}

          {errorMsg && (
            <div className="p-3 mb-4 rounded bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300 flex items-center gap-2 text-sm font-medium">
              <AlertCircle className="w-4 h-4" /> {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="opt_name">Option Code / Name *</Label>
              <Input id="opt_name" placeholder="e.g. 1.0 kg or Heart" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor="opt_disp">Display Name (Storefront Label)</Label>
              <Input id="opt_disp" placeholder="e.g. 1.0 Kilogram or Romantic Heart" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            {activeType !== "weight" && (
              <div>
                <Label htmlFor="opt_mod">Price Modifier (₹ Extra)</Label>
                <Input id="opt_mod" type="number" placeholder="e.g. 500 or 150" value={priceModifier} onChange={(e) => setPriceModifier(e.target.value)} />
              </div>
            )}

            {activeType === "weight" && (
              <>
                <div>
                  <Label htmlFor="opt_w_val">Weight Numeric Value</Label>
                  <Input id="opt_w_val" type="number" step="0.1" placeholder="1.0" value={weightVal} onChange={(e) => setWeightVal(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="opt_unit">Unit</Label>
                  <select id="opt_unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="pound">pound</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <Label htmlFor="opt_order">Display Order</Label>
              <Input id="opt_order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                Save Master Option
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Options Grid */}
      <Container className="p-6">
        <Text className="font-semibold text-base mb-4">Master Options ({filtered.length})</Text>

        {loading ? (
          <GridSkeleton count={6} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-ui-fg-subtle">
            <Sliders className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <Text>No master options registered for {activeType}.</Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((opt) => {
              const mod = opt.price_modifier || 0;
              return (
                <div key={opt.id} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-subtle/50 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Text className="font-bold text-base text-ui-fg-base">{opt.name}</Text>
                      <Badge color={mod > 0 ? "purple" : "grey"}>
                        {mod > 0 ? `+₹${mod}` : "Included (+₹0)"}
                      </Badge>
                    </div>
                    <Text className="text-xs text-ui-fg-subtle">{opt.display_name || opt.name}</Text>
                    <Text className="text-[10px] text-purple-600">Order: #{opt.display_order || 0}</Text>
                  </div>

                  <div className="pt-2 border-t border-ui-border-base flex items-center justify-end gap-2">
                    <Button size="small" variant="transparent" onClick={() => handleOpenEditModal(opt)} className="text-blue-600">
                      <Edit3 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button size="small" variant="transparent" onClick={() => handleDelete(opt.id, opt.name)} className="text-rose-600">
                      <Trash2 className="w-4 h-4" /> Archive
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Container>
    </div>
  );
}
