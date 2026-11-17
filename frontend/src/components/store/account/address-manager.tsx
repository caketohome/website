"use client";

import React, { useState } from "react";
import {
  MapPin,
  Plus,
  Home,
  Briefcase,
  Building,
  CheckCircle2,
  Trash2,
  Edit2,
  ShieldCheck,
  Store,
  Sparkles,
  Phone,
} from "lucide-react";
import { useAddresses, type CustomerAddress } from "@/hooks/use-addresses";

interface AddressManagerProps {
  initialAddresses?: any[];
}

export function AddressManager({ initialAddresses = [] }: AddressManagerProps) {
  const { addresses, loading, saving, saveAddress, deleteAddress } = useAddresses();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [type, setType] = useState<"HOME" | "OFFICE" | "OTHER">("HOME");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [isDefault, setIsDefault] = useState(false);

  const openAddModal = () => {
    setEditingId(null);
    setType("HOME");
    setName("");
    setPhone("");
    setAddress1("");
    setAddress2("");
    setLandmark("");
    setCity("");
    setState("");
    setPincode("");
    setIsDefault(addresses.length === 0);
    setShowModal(true);
  };

  const openEditModal = (addr: any) => {
    setEditingId(addr.id);
    setType(addr.type || "HOME");
    setName(addr.name || addr.first_name || "");
    setPhone(addr.phone || "");
    setAddress1(addr.address_1 || addr.line1 || "");
    setAddress2(addr.address_2 || addr.line2 || "");
    setLandmark(addr.landmark || "");
    setCity(addr.city || "");
    setState(addr.state || "");
    setPincode(addr.postal_code || addr.pincode || "");
    setIsDefault(Boolean(addr.is_default || addr.is_default_shipping));
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address1.trim()) return;

    await saveAddress({
      id: editingId || undefined,
      type,
      label: type === "HOME" ? "Home" : type === "OFFICE" ? "Office" : "Other",
      name: name || "Customer",
      phone,
      address_1: address1,
      address_2: address2,
      landmark,
      city,
      state,
      postal_code: pincode,
      is_default: isDefault,
    });

    setShowModal(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAddress(id);
  };

  const handleSetDefault = async (id: string) => {
    await saveAddress({ id, is_default: true });
  };

  const getTypeIcon = (t: string) => {
    if (t === "OFFICE") return <Briefcase className="w-4 h-4 text-blue-400" />;
    if (t === "OTHER") return <Building className="w-4 h-4 text-brand-primary" />;
    return <Home className="w-4 h-4 text-brand-gold" />;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-brand-text tracking-tight flex items-center gap-2.5">
            <MapPin className="w-6 h-6 text-brand-gold" />
            <span>Saved Addresses</span>
          </h2>
          <p className="text-xs text-brand-text-muted mt-1">
            Seamless 1-click delivery checkout with instant branch kitchen routing.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-brand-navy hover:bg-brand-primary text-white text-xs font-black transition-all shadow-md shadow-brand-gold/20 active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New Address
        </button>
      </div>

      {/* Address Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {addresses.map((addr) => (
          <div
            key={addr.id}
            className={`rounded-3xl p-5 sm:p-6 border transition-all relative overflow-hidden flex flex-col justify-between gap-4 shadow-xl backdrop-blur-sm ${
              addr.is_default
                ? "bg-gradient-to-br from-neutral-900 via-neutral-900 to-brand-gold-dark/20 border-brand-gold/40"
                : "bg-white border-brand-border hover:border-brand-border"
            }`}
          >
            <div className="space-y-3">
              {/* Type Pill & Default Badge */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-brand-surface-muted flex items-center justify-center">
                    {getTypeIcon(addr.type || "home")}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-text">
                    {addr.label || addr.type || "Home"}
                  </span>
                </div>

                {addr.is_default && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-brand-gold/20 text-brand-gold/40 border border-brand-gold/30">
                    <CheckCircle2 className="w-3 h-3" /> Default Delivery
                  </span>
                )}
              </div>

              {/* Name & Phone */}
              <div>
                <p className="text-sm font-bold text-brand-text">{addr.name || "Alex R Ashok"}</p>
                <p className="text-xs text-brand-text-muted font-mono mt-0.5">{addr.phone || "+91 98765 43210"}</p>
              </div>

              {/* Full Address */}
              <div className="text-xs text-brand-text space-y-0.5 leading-relaxed">
                <p>{addr.address_1 || (addr as any).line1 || ""}</p>
                {addr.address_2 && <p className="text-brand-text-muted">{addr.address_2}</p>}
                {addr.landmark && (
                  <p className="text-brand-text-muted italic">Landmark: {addr.landmark}</p>
                )}
                <p className="font-semibold text-brand-text">
                  {[addr.city, addr.state].filter(Boolean).join(", ")}{addr.postal_code || (addr as any).pincode ? ` – ${addr.postal_code || (addr as any).pincode}` : ""}
                </p>
              </div>

              {/* Branch Connection Indicator */}
              <div className="pt-2 border-t border-brand-border flex items-center gap-1.5 text-[11px] text-brand-gold/90 font-medium">
                <Store className="w-3.5 h-3.5" />
                <span>Routed to: {(addr as any).branch_name || "Nearest Hub Kitchen"}</span>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-brand-border">
              {!addr.is_default ? (
                <button
                  onClick={() => handleSetDefault(addr.id)}
                  className="text-xs text-brand-text-muted hover:text-brand-gold font-medium hover:underline transition-colors"
                >
                  Set as Default
                </button>
              ) : (
                <span className="text-[11px] text-[#16834A] font-semibold">✓ Primary Delivery</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(addr)}
                  className="p-2 rounded-xl bg-brand-surface-muted hover:bg-brand-surface-muted text-brand-text hover:text-brand-navy transition-colors"
                  title="Edit Address"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => handleDelete(addr.id)}
                  className="p-2 rounded-xl bg-brand-surface-muted hover:bg-brand-deep/80 text-brand-text-muted hover:text-brand-gold transition-colors"
                  title="Delete Address"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── MODAL: ADD / EDIT ADDRESS ────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-warm-white backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-white border border-brand-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-brand-border">
              <h3 className="text-lg font-bold text-brand-text flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-gold" />
                <span>{editingId ? "Edit Delivery Address" : "Add Delivery Address"}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-brand-text-muted hover:text-brand-navy text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Type Pill Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-brand-text">Address Category</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["HOME", "OFFICE", "OTHER"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={`py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition-all ${
                        type === t
                          ? "bg-brand-gold text-brand-text border-brand-gold font-black shadow-md shadow-brand-gold/20"
                          : "bg-brand-warm-white border-brand-border text-brand-text-muted hover:text-brand-navy"
                      }`}
                    >
                      {getTypeIcon(t)}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-text">Recipient Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alex R Ashok"
                    className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-text">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold font-mono"
                  />
                </div>
              </div>

              {/* Address Line 1 */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-text">
                  Flat, House No., Building, Street <span className="text-brand-gold">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={address1}
                  onChange={(e) => setAddress1(e.target.value)}
                  placeholder="e.g. Flat 402, Prestige Palms, 100ft Road"
                  className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                />
              </div>

              {/* Landmark */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-brand-text">Nearby Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Sony Center"
                  className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3.5 py-2.5 text-xs text-brand-text placeholder:text-brand-text-muted/70 focus:border-brand-gold focus:ring-1 focus:ring-brand-gold"
                />
              </div>

              {/* City, State, Pincode */}
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-text">City</label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-text">State</label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-brand-text">Pincode <span className="text-brand-text-muted font-normal">(Optional)</span></label>
                  <input
                    type="text"
                    maxLength={6}
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
                    placeholder="Auto-filled from map"
                    className="w-full bg-brand-warm-white border border-brand-border rounded-xl px-3 py-2 text-xs text-brand-text font-mono"
                  />
                </div>
              </div>

              {/* Set as default checkbox */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default_cb"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="w-4 h-4 rounded bg-brand-warm-white border-brand-border text-brand-gold focus:ring-brand-gold"
                />
                <label htmlFor="is_default_cb" className="text-xs text-brand-text font-medium">
                  Make this my default address for all cake deliveries
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-brand-text-muted hover:text-brand-navy"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-2xl bg-brand-navy hover:bg-brand-primary text-white text-xs font-black shadow-lg shadow-brand-gold/20 active:scale-95 transition-all"
                >
                  {editingId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
