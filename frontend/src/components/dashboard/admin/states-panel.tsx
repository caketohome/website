"use client";

import { useEffect, useState, memo } from "react";
import { Container, Heading, Text, Button, Input, Badge, Label } from "@medusajs/ui";
import { Plus, Globe2, Trash2, RotateCw, Edit3, CheckCircle, ShieldCheck } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

export const StatesPanel = memo(function StatesPanel() {
  const [states, setStates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | "archived" | "all">("active");

  // Create/Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [editingState, setEditingState] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [gstStateCode, setGstStateCode] = useState("");
  const [countryId, setCountryId] = useState("country_in");
  const [countryCode, setCountryCode] = useState("IN");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [currency, setCurrency] = useState("INR");
  const [currencySymbol, setCurrencySymbol] = useState("₹");
  const [displayOrder, setDisplayOrder] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchStates = () => {
    setLoading(true);
    setError(null);
    apiClient.getAdminStates()
      .then((r: any) => setStates(r?.states || []))
      .catch((err: any) => {
        setError(err.message || "Failed to load states");
        setStates([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStates(); }, []);

  const filtered = states.filter((s) => {
    if (filter === "all") return true;
    const st = s.status || "active";
    return filter === "active" ? st === "active" : st === "archived";
  });

  const handleOpenCreate = () => {
    setEditingState(null);
    setName("");
    setCode("");
    setGstStateCode("");
    setCountryId("country_in");
    setCountryCode("IN");
    setTimezone("Asia/Kolkata");
    setCurrency("INR");
    setCurrencySymbol("₹");
    setDisplayOrder(String(states.length + 1));
    setShowModal(true);
  };

  const handleOpenEdit = (st: any) => {
    setEditingState(st);
    setName(st.name || "");
    setCode(st.code || "");
    setGstStateCode(st.gst_state_code || "");
    setCountryId(st.country_id || "country_in");
    setCountryCode(st.country_code || "IN");
    setTimezone(st.timezone || "Asia/Kolkata");
    setCurrency(st.currency || "INR");
    setCurrencySymbol(st.currency_symbol || "₹");
    setDisplayOrder(String(st.display_order || 1));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      alert("State Name and 2-letter Code are required.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name,
        code: code.trim().toUpperCase(),
        gst_state_code: gstStateCode.trim(),
        country_id: countryId,
        country_code: countryCode.trim().toUpperCase(),
        timezone,
        currency,
        currency_symbol: currencySymbol,
        display_order: Number(displayOrder) || 1,
      };
      if (editingState) {
        await apiClient.updateAdminState(editingState.id, payload);
      } else {
        await apiClient.createAdminState(payload);
      }
      setShowModal(false);
      setSuccessMsg(editingState ? "State updated successfully!" : "State created successfully!");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchStates();
    } catch (err: any) {
      alert(`Failed to save state: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this state?")) return;
    try {
      await apiClient.archiveAdminState(id);
      fetchStates();
    } catch (err: any) {
      alert(`Failed to archive state: ${err.message}`);
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await apiClient.restoreAdminState(id);
      fetchStates();
    } catch (err: any) {
      alert(`Failed to restore state: ${err.message}`);
    }
  };

  return (
    <Container className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <Heading level="h2" className="flex items-center gap-2">
            <Globe2 className="w-5 h-5 text-pink-500" />
            State & Territory Master Registry
          </Heading>
          <Text className="text-ui-fg-muted text-sm mt-1">
            Authoritative registry of Indian States & UTs with GST place-of-supply codes and statutory tax bindings.
          </Text>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="small" onClick={fetchStates} disabled={loading}>
            <RotateCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="primary" size="small" onClick={handleOpenCreate}>
            <Plus className="w-4 h-4 mr-1" />
            Add State / UT
          </Button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:emerald-300 text-sm flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          {successMsg}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-sm">
          {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter("active")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === "active" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          Active ({states.filter((s) => (s.status || "active") === "active").length})
        </button>
        <button
          onClick={() => setFilter("archived")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === "archived" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          Archived ({states.filter((s) => s.status === "archived").length})
        </button>
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            filter === "all" ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
          }`}
        >
          All States ({states.length})
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="p-3">Order</th>
              <th className="p-3">State / UT Name</th>
              <th className="p-3">State Code</th>
              <th className="p-3">GST State Code</th>
              <th className="p-3">Country</th>
              <th className="p-3">Timezone</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
            {filtered.map((st) => (
              <tr key={st.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                <td className="p-3 text-slate-400 font-mono">{st.display_order || 1}</td>
                <td className="p-3">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-pink-500 shrink-0" />
                    {st.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">{st.id}</div>
                </td>
                <td className="p-3 font-mono font-bold text-pink-600">{st.code}</td>
                <td className="p-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                  {st.gst_state_code ? `GST: ${st.gst_state_code}` : "—"}
                </td>
                <td className="p-3 text-slate-600 dark:text-slate-400">{st.country_code || "IN"}</td>
                <td className="p-3 text-slate-500 font-mono text-[11px]">{st.timezone || "Asia/Kolkata"}</td>
                <td className="p-3">
                  <Badge color={(st.status || "active") === "active" ? "green" : "grey"} size="small">
                    {(st.status || "active").toUpperCase()}
                  </Badge>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button variant="secondary" size="small" onClick={() => handleOpenEdit(st)} className="h-7 w-7 p-0">
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    {(st.status || "active") === "active" ? (
                      <Button variant="danger" size="small" onClick={() => handleArchive(st.id)} className="h-7 w-7 p-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button variant="secondary" size="small" onClick={() => handleRestore(st.id)} className="h-7 w-7 p-0 text-emerald-600">
                        <RotateCw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-slate-400">
                  No states found matching your criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <Heading level="h3" className="mb-4">
              {editingState ? "Edit State / UT" : "Add New State / UT"}
            </Heading>
            <form onSubmit={handleSave} className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1">State / UT Name *</Label>
                  <Input placeholder="e.g. Karnataka, Kerala" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <Label className="text-xs mb-1">2-Letter State Code *</Label>
                  <Input placeholder="e.g. KA, KL, TN, MH" value={code} maxLength={2} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1">GST State Code (2 digits)</Label>
                  <Input placeholder="e.g. 29, 32, 33, 27" value={gstStateCode} maxLength={2} onChange={(e) => setGstStateCode(e.target.value.replace(/\D/g, ""))} />
                </div>
                <div>
                  <Label className="text-xs mb-1">Display Order</Label>
                  <Input type="number" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value)} min={1} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs mb-1">Country Code</Label>
                  <Input value={countryCode} onChange={(e) => setCountryCode(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <Label className="text-xs mb-1">Timezone</Label>
                  <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
                <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingState ? "Save Changes" : "Create State"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Container>
  );
});
