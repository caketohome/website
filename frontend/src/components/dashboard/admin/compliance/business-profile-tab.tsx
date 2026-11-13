"use client";

import { useState, useEffect } from "react";
import { Container, Heading, Text, Button, Input, Label, Badge } from "@medusajs/ui";
import { Building2, Save, CheckCircle2, ShieldCheck, Mail, Phone, MapPin, User, FileText } from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";

const ENTITY_TYPES = [
  { value: "PRIVATE_LIMITED", label: "Private Limited Company (Pvt Ltd)" },
  { value: "PUBLIC_LIMITED", label: "Public Limited Company (Ltd)" },
  { value: "LLP", label: "Limited Liability Partnership (LLP)" },
  { value: "PARTNERSHIP", label: "Partnership Firm" },
  { value: "PROPRIETORSHIP", label: "Sole Proprietorship" },
  { value: "OPC", label: "One Person Company (OPC)" },
  { value: "OTHER", label: "Other Legal Entity" },
];

export function BusinessProfileTab({
  profile,
  onProfileUpdated,
}: {
  profile: any;
  onProfileUpdated: (updated: any) => void;
}) {
  const [formData, setFormData] = useState({
    legal_name: profile?.legal_name || "Baked Cakes & Pastries (CakeToHome)",
    trade_name: profile?.trade_name || "CakeToHome",
    business_type: profile?.business_type || "PROPRIETORSHIP",
    pan: profile?.pan || "",
    tan: profile?.tan || "",
    cin: profile?.cin || null,
    registered_email: profile?.registered_email || "caketohomeoffice@gmail.com",
    registered_phone: profile?.registered_phone || "+91 81389 16888",
    website: profile?.website || "https://cakestohome.com",
    support_email: profile?.support_email || "caketohomeoffice@gmail.com",
    support_phone: profile?.support_phone || "+91 81389 16888",
    registered_address: {
      line1: profile?.registered_address?.line1 || "16/956, Thannimukku",
      line2: profile?.registered_address?.line2 || "Mayyanad",
      city: profile?.registered_address?.city || "Kollam",
      state: profile?.registered_address?.state || "Kerala",
      state_code: profile?.registered_address?.state_code || "32",
      country: profile?.registered_address?.country || "India",
      country_code: profile?.registered_address?.country_code || "IN",
      pincode: profile?.registered_address?.pincode || "691303",
    },
    primary_contact: {
      name: profile?.primary_contact?.name || "CakeToHome Operations",
      phone: profile?.primary_contact?.phone || "+91 81389 16888",
      email: profile?.primary_contact?.email || "caketohomeoffice@gmail.com",
      designation: profile?.primary_contact?.designation || "Proprietor / Authorized Manager",
    },
    authorized_signatory: {
      name: profile?.authorized_signatory?.name || "CakeToHome Operations",
      designation: profile?.authorized_signatory?.designation || "Authorized Signatory",
      email: profile?.authorized_signatory?.email || "caketohomeoffice@gmail.com",
      phone: profile?.authorized_signatory?.phone || "+91 81389 16888",
    },
    logo_url: profile?.logo_url || "/assets/brand/caketo-home-logo-navy.png",
    status: profile?.status || "ACTIVE",
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile && Object.keys(profile).length > 0) {
      setFormData((prev) => ({
        ...prev,
        legal_name: profile.legal_name ?? prev.legal_name,
        trade_name: profile.trade_name ?? prev.trade_name,
        business_type: profile.business_type ?? prev.business_type,
        pan: profile.pan ?? prev.pan,
        tan: profile.tan ?? prev.tan,
        cin: profile.cin ?? prev.cin,
        registered_email: profile.registered_email ?? prev.registered_email,
        registered_phone: profile.registered_phone ?? prev.registered_phone,
        website: profile.website ?? prev.website,
        support_email: profile.support_email ?? prev.support_email,
        support_phone: profile.support_phone ?? prev.support_phone,
        registered_address: {
          ...prev.registered_address,
          ...(profile.registered_address || {}),
        },
        primary_contact: {
          ...prev.primary_contact,
          ...(profile.primary_contact || {}),
        },
        authorized_signatory: {
          ...prev.authorized_signatory,
          ...(profile.authorized_signatory || {}),
        },
        logo_url: profile.logo_url ?? prev.logo_url,
        status: profile.status ?? prev.status,
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const res: any = await apiClient.updateBusinessProfile(formData);
      const updated = res?.profile || res?.data || formData;
      onProfileUpdated(updated);
      setSuccessMsg("Business Profile & statutory corporate information updated successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to update business profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {errorMsg && (
        <div id="business-profile-error" role="alert" className="p-3.5 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-200 text-sm rounded-xl flex items-center gap-2">
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div id="business-profile-success" className="p-3.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Header Summary Card */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-200/70 dark:border-amber-900/40 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {formData.legal_name || "Company Legal Name"}
              </h3>
              <Badge color="green" size="small" className="font-mono text-xs">
                {formData.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Trade Brand: <span className="font-semibold text-slate-700 dark:text-slate-200">{formData.trade_name}</span> &bull; PAN: <span className="font-mono font-semibold">{formData.pan}</span> &bull; CIN: <span className="font-mono">{formData.cin || "N/A"}</span>
            </p>
          </div>
        </div>
        <Button
          type="submit"
          isLoading={saving}
          className="bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 self-start md:self-auto"
        >
          <Save className="w-4 h-4" /> Save Business Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Identity & Registrations */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <ShieldCheck className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Corporate Legal Identity
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="legal_name" className="text-xs font-semibold">Legal Entity Name (As per MCA / PAN)</Label>
              <Input
                id="legal_name"
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="trade_name" className="text-xs font-semibold">Trade / Brand Name</Label>
              <Input
                id="trade_name"
                value={formData.trade_name}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="business_type" className="text-xs font-semibold">Entity Type</Label>
              <select
                id="business_type"
                value={formData.business_type}
                onChange={(e) => setFormData({ ...formData, business_type: e.target.value as any })}
                className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                {ENTITY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label htmlFor="pan" className="text-xs font-semibold">Company PAN (Permanent Account No)</Label>
              <Input
                id="pan"
                value={formData.pan}
                onChange={(e) => setFormData({ ...formData, pan: e.target.value.toUpperCase() })}
                required
                maxLength={10}
                className="mt-1 font-mono uppercase"
              />
            </div>

            <div>
              <Label htmlFor="tan" className="text-xs font-semibold">Tax Deduction Account No (TAN)</Label>
              <Input
                id="tan"
                value={formData.tan || ""}
                onChange={(e) => setFormData({ ...formData, tan: e.target.value.toUpperCase() })}
                maxLength={10}
                className="mt-1 font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="cin" className="text-xs font-semibold">Corporate Identity Number (CIN / LLPIN)</Label>
              <Input
                id="cin"
                value={formData.cin || ""}
                onChange={(e) => setFormData({ ...formData, cin: e.target.value.toUpperCase() })}
                maxLength={21}
                className="mt-1 font-mono uppercase"
              />
            </div>
          </div>
        </Container>

        {/* Registered Corporate Office Address */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <MapPin className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Registered Corporate Address
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label htmlFor="addr_line1" className="text-xs font-semibold">Address Line 1</Label>
              <Input
                id="addr_line1"
                value={formData.registered_address.line1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, line1: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="addr_line2" className="text-xs font-semibold">Address Line 2 (Area / Locality)</Label>
              <Input
                id="addr_line2"
                value={formData.registered_address.line2 || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, line2: e.target.value },
                  })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="addr_city" className="text-xs font-semibold">City</Label>
              <Input
                id="addr_city"
                value={formData.registered_address.city}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, city: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="addr_state" className="text-xs font-semibold">State</Label>
              <Input
                id="addr_state"
                value={formData.registered_address.state}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, state: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="addr_pincode" className="text-xs font-semibold">Postal / PIN Code</Label>
              <Input
                id="addr_pincode"
                value={formData.registered_address.pincode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, pincode: e.target.value },
                  })
                }
                required
                maxLength={6}
                className="mt-1 font-mono"
              />
            </div>

            <div>
              <Label htmlFor="addr_state_code" className="text-xs font-semibold">GST State Code (2-Digit)</Label>
              <Input
                id="addr_state_code"
                value={formData.registered_address.state_code}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    registered_address: { ...formData.registered_address, state_code: e.target.value },
                  })
                }
                required
                maxLength={2}
                className="mt-1 font-mono"
              />
            </div>
          </div>
        </Container>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Support & Public Contact Channels */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <Mail className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Customer Support & Communications
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="support_email" className="text-xs font-semibold">Customer Support Email</Label>
              <Input
                id="support_email"
                type="email"
                value={formData.support_email}
                onChange={(e) => setFormData({ ...formData, support_email: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="support_phone" className="text-xs font-semibold">Customer Support Helpline</Label>
              <Input
                id="support_phone"
                value={formData.support_phone}
                onChange={(e) => setFormData({ ...formData, support_phone: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="registered_email" className="text-xs font-semibold">Official Corporate / Statutory Email</Label>
              <Input
                id="registered_email"
                type="email"
                value={formData.registered_email}
                onChange={(e) => setFormData({ ...formData, registered_email: e.target.value })}
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="website" className="text-xs font-semibold">Official Website URL</Label>
              <Input
                id="website"
                value={formData.website || ""}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </Container>

        {/* Authorized Signatory & Compliance Officer */}
        <Container className="p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
            <User className="w-4 h-4 text-amber-600" />
            <Text className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Authorized Signatory for Invoices
            </Text>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sig_name" className="text-xs font-semibold">Signatory Full Name</Label>
              <Input
                id="sig_name"
                value={formData.authorized_signatory.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    authorized_signatory: { ...formData.authorized_signatory, name: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sig_desig" className="text-xs font-semibold">Official Designation</Label>
              <Input
                id="sig_desig"
                value={formData.authorized_signatory.designation}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    authorized_signatory: { ...formData.authorized_signatory, designation: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sig_email" className="text-xs font-semibold">Signatory Email</Label>
              <Input
                id="sig_email"
                type="email"
                value={formData.authorized_signatory.email}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    authorized_signatory: { ...formData.authorized_signatory, email: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="sig_phone" className="text-xs font-semibold">Signatory Contact Phone</Label>
              <Input
                id="sig_phone"
                value={formData.authorized_signatory.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    authorized_signatory: { ...formData.authorized_signatory, phone: e.target.value },
                  })
                }
                required
                className="mt-1"
              />
            </div>
          </div>
        </Container>
      </div>
    </form>
  );
}
