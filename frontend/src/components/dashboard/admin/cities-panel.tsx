"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Plus, Globe2, Trash2, RotateCw, Edit3, MapPin, Building2, CheckCircle } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export const CitiesPanel = memo(function CitiesPanel() {
  const [cities, setCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  // Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingCity, setEditingCity] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [state, setState] = useState("");
  const [stateCode, setStateCode] = useState("");
  const [country, setCountry] = useState("India");
  const [countryCode, setCountryCode] = useState("IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [phoneCode, setPhoneCode] = useState("+91");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCities = () => {
    setLoading(true);
    setError(null);
    apiClient.getAdminCities()
      .then((r: any) => setCities(r?.cities || []))
      .catch((err: any) => {
        setError(err.message || "Failed to load cities");
        setCities([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCities(); }, []);

  const filtered = cities.filter((c) => {
    if (filter === "all") return true;
    const s = c.status || "active";
    return filter === "active" ? s === "active" : s === "archived";
  });

  const handleOpenCreate = () => {
    setEditingCity(null);
    setName("");
    setSlug("");
    setState("");
    setStateCode("");
    setCountry("India");
    setCountryCode("IN");
    setTimezone("Asia/Kolkata");
    setCurrency("INR");
    setPhoneCode("+91");
    setDisplayOrder(String(cities.length + 1));
    setShowModal(true);
  };

  const handleOpenEdit = (city: any) => {
    setEditingCity(city);
    setName(city.name || "");
    setSlug(city.slug || "");
    setState(city.state || "");
    setStateCode(city.stateCode || "");
    setCountry(city.country || "India");
    setCountryCode(city.countryCode || "IN");
    setTimezone(city.timezone || "Asia/Kolkata");
    setCurrency(city.currency || "INR");
    setPhoneCode(city.phoneCode || "+91");
    setDisplayOrder(String(city.displayOrder || 1));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name, slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        state, stateCode, country, countryCode, timezone, currency, phoneCode,
        displayOrder: Number(displayOrder) || 1,
      };
      if (editingCity) {
        await apiClient.updateAdminCity(editingCity.id, payload);
      } else {
        await apiClient.createAdminCity(payload);
      }
      setShowModal(false);
      setSuccessMsg(editingCity ? "City updated successfully!" : "City created successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchCities();
    } catch (err: any) {
      alert(`Failed to save city: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (city: any) => {
    if (!confirm(`Archive "${city.name}"? It will be hidden from the storefront.`)) return;
    try {
      await apiClient.archiveAdminCity(city.id);
      fetchCities();
    } catch (err: any) {
      alert(`Failed to archive: ${err.message}`);
    }
  };

  const handleRestore = async (city: any) => {
    try {
      await apiClient.restoreAdminCity(city.id);
      fetchCities();
    } catch (err: any) {
      alert(`Failed to restore: ${err.message}`);
    }
  };

  const handleMigrate = async () => {
    if (!confirm("Run multi-city data migration? This will assign all existing branches to their respective city records.")) return;
    try {
      const result: any = await apiClient.migrateToMultiCity();
      setSuccessMsg(`Migration complete: ${result.migrated_branches || 0} branches migrated, ${result.orphaned || 0} orphaned.`);
      setTimeout(() => setSuccessMsg(null), 5000);
      fetchCities();
    } catch (err: any) {
      alert(`Migration failed: ${err.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <Heading level="h3" className="text-base font-bold flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-purple-600" /> Cities & Locations
          </Heading>
          <Text className="text-xs text-slate-500 mt-1">Manage serviceable cities across the platform</Text>
        </div>
        <div className="flex items-center gap-2">
          <Button size="small" variant="transparent" onClick={handleMigrate} className="text-xs">
            <RotateCw className="w-3.5 h-3.5 mr-1" /> Run Migration
          </Button>
          <Button size="small" onClick={handleOpenCreate} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs">
            <Plus className="w-4 h-4 mr-1" /> Add City
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <Text className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">{successMsg}</Text>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {(["active", "archived", "all"] as const).map((f) => (
          <Badge
            key={f}
            color={filter === f ? "purple" : "grey"}
            className="cursor-pointer px-3 py-1 text-xs font-semibold capitalize"
            onClick={() => setFilter(f)}
          >
            {f}
          </Badge>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-sm">Loading cities...</div>
      ) : error ? (
        <div className="text-center py-8 text-red-500 text-sm">{error}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">No cities found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((city) => (
            <div
              key={city.id}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe2 className="w-4 h-4 text-purple-600" />
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{city.name}</span>
                </div>
                <Badge
                  color={city.status === "active" ? "green" : "red"}
                  className="uppercase font-mono text-[10px]"
                >
                  {city.status || "active"}
                </Badge>
              </div>

              <div className="text-xs text-slate-500 space-y-1">
                <div className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {city.state}, {city.country || "India"}</div>
                <div className="flex items-center gap-1"><Building2 className="w-3 h-3" /> Slug: /{city.slug}</div>
              </div>

              {/* Stats */}
              {city.stats && (
                <div className="flex gap-3">
                  <div className="text-center">
                    <div className="text-lg font-bold text-purple-600">{city.stats.branches}</div>
                    <div className="text-[10px] text-slate-400">Stores</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-blue-600">{city.stats.zones}</div>
                    <div className="text-[10px] text-slate-400">Zones</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-emerald-600">{city.stats.pincodes}</div>
                    <div className="text-[10px] text-slate-400">Pincodes</div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t">
                <Button size="small" variant="transparent" onClick={() => handleOpenEdit(city)} className="text-xs">
                  <Edit3 className="w-3 h-3 mr-1" /> Edit
                </Button>
                {city.status === "active" ? (
                  <Button size="small" variant="transparent" onClick={() => handleArchive(city)} className="text-xs text-red-600">
                    <Trash2 className="w-3 h-3 mr-1" /> Archive
                  </Button>
                ) : (
                  <Button size="small" variant="transparent" onClick={() => handleRestore(city)} className="text-xs text-emerald-600">
                    <RotateCw className="w-3 h-3 mr-1" /> Restore
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-8">
            <div className="p-4 border-b flex items-center justify-between bg-purple-50 dark:bg-purple-950/40">
              <Heading level="h3" className="text-base font-bold flex items-center gap-2">
                <Globe2 className="w-5 h-5 text-purple-600" />
                {editingCity ? `Edit City: ${editingCity.name}` : "Add New City"}
              </Heading>
              <Button size="small" variant="transparent" onClick={() => setShowModal(false)}>Close</Button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>City Name *</Label>
                  <Input value={name} onChange={(e) => { setName(e.target.value); if (!editingCity) setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")); }} required />
                </div>
                <div>
                  <Label>URL Slug *</Label>
                  <Input value={slug} onChange={(e) => setSlug(e.target.value)} required placeholder="e.g. bengaluru" />
                </div>
                <div>
                  <Label>State *</Label>
                  <Input value={state} onChange={(e) => setState(e.target.value)} required placeholder="e.g. Karnataka" />
                </div>
                <div>
                  <Label>State Code</Label>
                  <Input value={stateCode} onChange={(e) => setStateCode(e.target.value)} placeholder="e.g. KA" />
                </div>
                <div>
                  <Label>Country</Label>
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div>
                  <Label>Country Code</Label>
                  <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value)} />
                </div>
                <div>
                  <Label>Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div>
                  <Label>Currency</Label>
                  <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
                </div>
                <div>
                  <Label>Phone Code</Label>
                  <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} />
                </div>
                <div>
                  <Label>Display Order</Label>
                  <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} />
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <Button type="button" variant="transparent" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button type="submit" isLoading={submitting} className="bg-purple-600 hover:bg-purple-700 text-white font-bold">
                  {editingCity ? "Update City" : "Create City"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
});
