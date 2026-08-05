"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { Scale, Plus, Edit3, Trash2, Search, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { GridSkeleton } from "./admin-skeletons";

export function WeightsManagementPanel() {
  const [weights, setWeights] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingWeight, setEditingWeight] = useState<any | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [weightVal, setWeightVal] = useState("");
  const [unit, setUnit] = useState("kg");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [status, setStatus] = useState("active");

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchWeights = () => {
    setLoading(true);
    apiClient
      .getAdminWeights()
      .then((r: any) => setWeights(r?.weights || r?.options || r?.data || []))
      .catch(() => null)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchWeights();
  }, []);

  const resetForm = () => {
    setName("");
    setDisplayName("");
    setWeightVal("");
    setUnit("kg");
    setDisplayOrder("1");
    setStatus("active");
    setEditingWeight(null);
    setErrorMsg(null);
  };

  const handleOpenCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const handleOpenEditModal = (w: any) => {
    setEditingWeight(w);
    setName(w.name || "");
    setDisplayName(w.display_name || w.name || "");
    setWeightVal(w.weight_val ? String(w.weight_val) : "");
    setUnit(w.unit || "kg");
    setDisplayOrder(String(w.display_order || 1));
    setStatus(w.status || "active");
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    const payload = {
      type: "weight",
      name: name.trim(),
      display_name: displayName.trim() || name.trim(),
      weight_val: weightVal ? parseFloat(weightVal) : 1.0,
      unit,
      price_modifier: 0,
      display_order: parseInt(displayOrder, 10) || 1,
      status,
    };

    try {
      if (editingWeight) {
        await apiClient.updateAdminWeight(editingWeight.id, payload);
        setSuccessMsg(`Updated weight "${name}"!`);
      } else {
        await apiClient.createAdminWeight(payload);
        setSuccessMsg(`Created weight size "${name}"!`);
      }
      fetchWeights();
      setTimeout(() => {
        setShowModal(false);
        resetForm();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to save weight.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, wName: string) => {
    if (!confirm(`Are you sure you want to archive weight size "${wName}"?`)) return;
    try {
      await apiClient.deleteAdminWeight(id);
      fetchWeights();
    } catch (err: any) {
      alert(err.message || "Failed to archive weight.");
    }
  };

  const filtered = weights.filter((w) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.display_name && w.display_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h2" className="text-xl font-bold flex items-center gap-2">
            <Scale className="w-5 h-5 text-purple-600" /> Master Weight Management
          </Heading>
          <Text className="text-ui-fg-subtle text-sm">
            Configure master weight sizes (e.g. 250g, 500g, 750g, 900g, 1kg, 1.25kg, 2kg, 5kg). Prices are configured per product in the Product Editor.
          </Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="transparent" onClick={fetchWeights} className="flex items-center gap-1">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="small" onClick={handleOpenCreateModal} className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white">
            <Plus className="w-4 h-4" /> Add New Weight Size
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Container className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ui-fg-subtle" />
          <Input
            placeholder="Search weight sizes (e.g. 500g, 1.5kg)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Container>

      {/* Create / Edit Modal */}
      {showModal && (
        <Container className="p-6 border-2 border-purple-500/30 bg-purple-50/20 dark:bg-purple-950/20">
          <div className="flex items-center justify-between mb-4">
            <Text className="font-semibold text-base">
              {editingWeight ? `Edit Weight "${editingWeight.name}"` : "Create Master Weight Size Option"}
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
              <Label htmlFor="w_name">Weight Code / Name (e.g. 750g or 1.25kg) *</Label>
              <Input id="w_name" placeholder="e.g. 750g or 1.25 kg" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div>
              <Label htmlFor="w_disp">Display Name (Storefront Label)</Label>
              <Input id="w_disp" placeholder="e.g. 750 Grams or 1.25 Kilograms" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="w_val">Numeric Value</Label>
              <Input id="w_val" type="number" step="0.05" placeholder="0.75" value={weightVal} onChange={(e) => setWeightVal(e.target.value)} />
            </div>

            <div>
              <Label htmlFor="w_unit">Unit</Label>
              <select id="w_unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="w-full h-10 px-3 rounded-md border border-ui-border-base bg-ui-bg-field text-sm">
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="pound">pound</option>
              </select>
            </div>

            <div>
              <Label htmlFor="w_order">Display Order</Label>
              <Input id="w_order" type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
            </div>

            <div className="md:col-span-2 flex items-center justify-end gap-2 pt-4 border-t border-ui-border-base">
              <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white">
                Save Master Weight
              </Button>
            </div>
          </form>
        </Container>
      )}

      {/* Grid Display */}
      <Container className="p-6">
        <Text className="font-semibold text-base mb-4">Database Master Weights ({filtered.length})</Text>

        {loading ? (
          <GridSkeleton count={4} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-ui-fg-subtle">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <Text>No master weight sizes found.</Text>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filtered.map((w) => (
              <div key={w.id} className="border border-ui-border-base rounded-xl p-4 bg-ui-bg-subtle/50 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Text className="font-bold text-base text-purple-600">{w.name}</Text>
                    <Badge color={w.status === "active" ? "green" : "grey"}>
                      {w.status || "active"}
                    </Badge>
                  </div>
                  <Text className="text-xs text-ui-fg-subtle">{w.display_name || w.name}</Text>
                  <Text className="text-[10px] text-ui-fg-muted">Order: #{w.display_order || 1}</Text>
                </div>

                <div className="pt-2 border-t border-ui-border-base flex items-center justify-end gap-2">
                  <Button size="small" variant="transparent" onClick={() => handleOpenEditModal(w)} className="text-blue-600">
                    <Edit3 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                  <Button size="small" variant="transparent" onClick={() => handleDelete(w.id, w.name)} className="text-rose-600">
                    <Trash2 className="w-4 h-4" /> Archive
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Container>
    </div>
  );
}
