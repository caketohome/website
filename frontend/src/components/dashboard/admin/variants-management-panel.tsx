"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Sliders, Plus, Edit3, Trash2, Search, CheckCircle, AlertCircle, Sparkles, Layers, Copy } from "lucide-react";
import { GridSkeleton } from "./admin-skeletons";

export function VariantsManagementPanel() {
  const [flavors, setFlavors] = useState<any[]>([]);
  const [shapes, setShapes] = useState<any[]>([]);
  const [activeType, setActiveType] = useState<"flavour" | "shape">("flavour");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Common & Flavor Form State
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [internalCode, setInternalCode] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("#9333ea");
  const [extraPrice, setExtraPrice] = useState("0");
  const [prepTime, setPrepTime] = useState("0");
  const [sortOrder, setSortOrder] = useState("1");
  const [status, setStatus] = useState("active");
  const [isEnabled, setIsEnabled] = useState(true);
  const [availOnline, setAvailOnline] = useState(true);
  const [availStore, setAvailStore] = useState(true);
  const [availPickup, setAvailPickup] = useState(true);
  const [availDelivery, setAvailDelivery] = useState(true);

  // Shape Specific
  const [previewUrl, setPreviewUrl] = useState("");
  const [additionalPrice, setAdditionalPrice] = useState("0");
  const [maxWeight, setMaxWeight] = useState("10");

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    Promise.all([
      apiClient.getAdminFlavors(search),
      apiClient.getAdminShapes(search),
    ])
      .then(([fRes, sRes]: any) => {
        setFlavors(fRes?.flavors || []);
        setShapes(sRes?.shapes || []);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [search]);

  const resetForm = () => {
    setName("");
    setDisplayName("");
    setInternalCode("");
    setDescription("");
    setImageUrl("");
    setIcon("");
    setColor("#9333ea");
    setExtraPrice("0");
    setPrepTime("0");
    setSortOrder("1");
    setStatus("active");
    setIsEnabled(true);
    setAvailOnline(true);
    setAvailStore(true);
    setAvailPickup(true);
    setAvailDelivery(true);
    setPreviewUrl("");
    setAdditionalPrice("0");
    setMaxWeight("10");
    setEditingItem(null);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setEditingItem(item);
    setName(item.name || "");
    setDisplayName(item.display_name || item.name || "");
    setInternalCode(item.internal_code || "");
    setDescription(item.description || "");
    setImageUrl(item.image_url || "");
    setIcon(item.icon || "");
    setColor(item.color || "#9333ea");
    setExtraPrice(String(item.extra_price ?? item.price_modifier ?? 0));
    setPrepTime(String(item.prep_time_minutes || 0));
    setSortOrder(String(item.sort_order || 1));
    setStatus(item.status || "active");
    setIsEnabled(item.is_enabled !== undefined ? Boolean(item.is_enabled) : true);
    setAvailOnline(item.available_online !== undefined ? Boolean(item.available_online) : true);
    setAvailStore(item.available_in_store !== undefined ? Boolean(item.available_in_store) : true);
    setAvailPickup(item.available_for_pickup !== undefined ? Boolean(item.available_for_pickup) : true);
    setAvailDelivery(item.available_for_delivery !== undefined ? Boolean(item.available_for_delivery) : true);
    setPreviewUrl(item.preview_url || "");
    setAdditionalPrice(String(item.additional_price ?? item.price_modifier ?? 0));
    setMaxWeight(String(item.max_weight || 10));
    setShowModal(true);
  };

  const handleDuplicate = (item: any) => {
    handleOpenEditModal(item);
    setEditingItem(null); // Create new entity instead of updating
    setName(`Copy of ${item.name || ""}`);
    setDisplayName(`Copy of ${item.display_name || item.name || ""}`);
    if (item.internal_code) {
      setInternalCode(`${item.internal_code}_COPY`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (activeType === "flavour") {
        const payload = {
          name,
          display_name: displayName || name,
          internal_code: internalCode,
          description,
          image_url: imageUrl,
          icon,
          color,
          extra_price: parseFloat(extraPrice) || 0,
          prep_time_minutes: parseInt(prepTime, 10) || 0,
          sort_order: parseInt(sortOrder, 10) || 1,
          status,
          is_enabled: isEnabled,
          available_online: availOnline,
          available_in_store: availStore,
          available_for_pickup: availPickup,
          available_for_delivery: availDelivery,
        };

        if (editingItem) {
          await apiClient.updateAdminFlavor(editingItem.id, payload);
          setSuccessMsg(`Updated flavor "${name}"!`);
        } else {
          await apiClient.createAdminFlavor(payload);
          setSuccessMsg(`Created flavor "${name}"!`);
        }
      } else {
        const payload = {
          name,
          image_url: imageUrl,
          preview_url: previewUrl,
          description,
          additional_price: parseFloat(additionalPrice) || 0,
          max_weight: parseFloat(maxWeight) || 10,
          prep_time_minutes: parseInt(prepTime, 10) || 0,
          sort_order: parseInt(sortOrder, 10) || 1,
          status,
          is_enabled: isEnabled,
        };

        if (editingItem) {
          await apiClient.updateAdminShape(editingItem.id, payload);
          setSuccessMsg(`Updated shape "${name}"!`);
        } else {
          await apiClient.createAdminShape(payload);
          setSuccessMsg(`Created shape "${name}"!`);
        }
      }

      fetchData();
      setTimeout(() => {
        setShowModal(false);
        resetForm();
      }, 800);
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to save ${activeType}.`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnable = async (item: any) => {
    try {
      const newEnabled = !item.is_enabled;
      if (activeType === "flavour") {
        await apiClient.patchAdminFlavorStatus(item.id, { is_enabled: newEnabled });
      } else {
        await apiClient.patchAdminShapeStatus(item.id, { is_enabled: newEnabled });
      }
      fetchData();
    } catch (err: any) {
      alert(err.message || "Failed to toggle status");
    }
  };

  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete ${activeType} "${item.name}"?`)) return;
    try {
      if (activeType === "flavour") {
        await apiClient.deleteAdminFlavor(item.id);
      } else {
        await apiClient.deleteAdminShape(item.id);
      }
      fetchData();
    } catch (err: any) {
      if (err.status === 409 || err.message?.includes("mapped")) {
        if (confirm(`${err.message}\n\nDo you want to archive this ${activeType} instead?`)) {
          if (activeType === "flavour") {
            await apiClient.patchAdminFlavorStatus(item.id, { status: "archived", is_enabled: false });
          } else {
            await apiClient.patchAdminShapeStatus(item.id, { status: "archived", is_enabled: false });
          }
          fetchData();
        }
      } else {
        alert(err.message || `Failed to delete ${activeType}.`);
      }
    }
  };

  const currentItems = activeType === "flavour" ? flavors : shapes;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <Sliders className="w-5 h-5 text-purple-600" /> Database-Driven Flavor & Shape Masters
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Configure dynamic bakery options, extra pricing rules, prep times, and availability matrices directly stored in the database.
          </Text>
        </div>
        <Button size="small" onClick={handleOpenCreateModal} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
          <Plus className="w-4 h-4" /> Add Master {activeType === "flavour" ? "Flavor" : "Shape"}
        </Button>
      </div>

      <div className="flex border-b border-ui-border-base px-2 gap-2 bg-ui-bg-subtle overflow-x-auto text-xs font-medium rounded-lg p-1">
        <button
          onClick={() => setActiveType("flavour")}
          className={`py-2 px-4 rounded flex items-center gap-1.5 ${activeType === "flavour" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}
        >
          <Sparkles className="w-4 h-4" /> Flavors ({flavors.length})
        </button>
        <button
          onClick={() => setActiveType("shape")}
          className={`py-2 px-4 rounded flex items-center gap-1.5 ${activeType === "shape" ? "bg-purple-600 text-white font-semibold" : "text-ui-fg-subtle hover:text-ui-fg-base"}`}
        >
          <Layers className="w-4 h-4" /> Shapes ({shapes.length})
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-ui-fg-muted" />
        <Input
          placeholder={`Search ${activeType === "flavour" ? "flavors" : "shapes"}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 text-xs"
        />
      </div>

      {loading ? (
        <GridSkeleton count={6} />
      ) : currentItems.length === 0 ? (
        <Container className="p-8 text-center">
          <Text className="text-ui-fg-muted">No {activeType === "flavour" ? "flavors" : "shapes"} found. Click \"Add Master\" to create one.</Text>
        </Container>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentItems.map((item) => {
            const isFlv = activeType === "flavour";
            const price = isFlv ? (item.extra_price || 0) : (item.additional_price || 0);
            return (
              <Container key={item.id} className="p-4 border rounded-xl flex flex-col justify-between gap-3 shadow-sm hover:border-purple-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isFlv && item.color && (
                      <span className="w-4 h-4 rounded-full inline-block border" style={{ backgroundColor: item.color }} />
                    )}
                    <div>
                      <Heading level="h3" className="text-sm font-bold text-slate-900 dark:text-white">
                        {item.display_name || item.name}
                      </Heading>
                      {item.internal_code && (
                        <Text className="text-[10px] font-mono text-purple-600">{item.internal_code}</Text>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge color={item.is_enabled ? "green" : "grey"} className="text-[10px] capitalize cursor-pointer" onClick={() => handleToggleEnable(item)}>
                      {item.is_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <Badge color={item.status === "active" ? "purple" : "red"} className="text-[10px] uppercase font-mono">
                      {item.status}
                    </Badge>
                  </div>
                </div>

                {item.description && (
                  <Text className="text-xs text-ui-fg-subtle line-clamp-2">{item.description}</Text>
                )}

                <div className="flex items-center justify-between text-xs pt-2 border-t font-medium">
                  <span className="text-emerald-600 font-bold">
                    {price > 0 ? `+₹${price}` : "Standard (No Surcharge)"}
                  </span>
                  <span className="text-ui-fg-muted text-[11px]">
                    Prep: {item.prep_time_minutes || 0} mins
                  </span>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2">
                  <Button size="small" variant="secondary" onClick={() => handleOpenEditModal(item)} className="text-xs">
                    <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                  <Button size="small" variant="secondary" onClick={() => handleDuplicate(item)} className="text-xs text-purple-600 hover:text-purple-700" title="Duplicate master entry">
                    <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => handleDelete(item)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </Container>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b flex items-center justify-between bg-purple-50 dark:bg-purple-950/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Sliders className="w-5 h-5 text-purple-600" />
                {editingItem ? `Edit ${activeType === "flavour" ? "Flavor" : "Shape"}` : `Create ${activeType === "flavour" ? "Flavor" : "Shape"}`}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs overflow-y-auto">
              {errorMsg && (
                <div className="p-3 bg-red-50 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 bg-green-50 text-green-700 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>Name *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Belgian Truffle" />
                </div>
                <div>
                  <Label>Display Name</Label>
                  <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Belgian Dark Truffle" />
                </div>

                {activeType === "flavour" ? (
                  <>
                    <div>
                      <Label>Internal Code</Label>
                      <Input value={internalCode} onChange={(e) => setInternalCode(e.target.value)} placeholder="FLV-TRUF-01" />
                    </div>
                    <div>
                      <Label>Extra Surcharge Price (₹)</Label>
                      <Input type="number" value={extraPrice} onChange={(e) => setExtraPrice(e.target.value)} />
                    </div>
                    <div>
                      <Label>Theme Color</Label>
                      <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 rounded border p-1" />
                    </div>
                    <div>
                      <Label>Preparation Extra Time (Mins)</Label>
                      <Input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <Label>Additional Price (₹)</Label>
                      <Input type="number" value={additionalPrice} onChange={(e) => setAdditionalPrice(e.target.value)} />
                    </div>
                    <div>
                      <Label>Max Weight Capacity (KG)</Label>
                      <Input type="number" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
                    </div>
                    <div>
                      <Label>Preparation Extra Time (Mins)</Label>
                      <Input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
                    </div>
                    <div>
                      <Label>Preview Image URL</Label>
                      <Input value={previewUrl} onChange={(e) => setPreviewUrl(e.target.value)} placeholder="https://..." />
                    </div>
                  </>
                )}

                <div className="sm:col-span-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description..." />
                </div>

                <div className="sm:col-span-2">
                  <Label>Image URL</Label>
                  <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                </div>

                <div>
                  <Label>Sort Order</Label>
                  <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
                </div>
                <div>
                  <Label>Status</Label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full p-2 border rounded-lg bg-white dark:bg-slate-900">
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div className="sm:col-span-2 pt-2 border-t flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isEnabled} onChange={(e) => setIsEnabled(e.target.checked)} className="rounded" />
                    <span className="font-semibold">Option Enabled for Storefront</span>
                  </label>
                </div>

                {activeType === "flavour" && (
                  <div className="sm:col-span-2 grid grid-cols-2 gap-2 text-xs pt-1">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={availOnline} onChange={(e) => setAvailOnline(e.target.checked)} />
                      <span>Online Delivery</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={availStore} onChange={(e) => setAvailStore(e.target.checked)} />
                      <span>In Store</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={availPickup} onChange={(e) => setAvailPickup(e.target.checked)} />
                      <span>Pickup</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" checked={availDelivery} onChange={(e) => setAvailDelivery(e.target.checked)} />
                      <span>Express Delivery</span>
                    </label>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  Save {activeType === "flavour" ? "Flavor" : "Shape"} Master
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
