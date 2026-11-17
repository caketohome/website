"use client";

import { useState } from "react";
import { Container, Heading, Text, Button, Input, Label, Select, Badge } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { X, User, Truck, Store, MapPin, Clock, ShieldCheck, CheckCircle2 } from "lucide-react";

interface WizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (partner: any) => void;
  branches: any[];
}

export function DeliveryPartnerWizard({ isOpen, onClose, onSuccess, branches }: WizardProps) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal Profile
    first_name: "",
    last_name: "",
    phone: "",
    alternate_phone: "",
    email: "",
    date_of_birth: "1996-05-15",
    address: "",
    city: "",
    state: "",
    pincode: "",
    emergency_contact_name: "",
    emergency_contact_relationship: "Family Member",
    emergency_contact_phone: "",

    // Step 2: Branch Associations
    primary_branch_id: branches[0]?.id || "res_01KXYMAHGFPRY1G9TZKEVGAGAT",
    secondary_branch_ids: [] as string[],

    // Step 3: Coverage Areas
    pincodes: "560038, 560034, 560047",
    areas: "Indiranagar, Koramangala, Domlur",

    // Step 4: Working Hours
    working_hours: {
      Monday: { working: true, start: "09:00", end: "21:00", break_start: "14:00", break_end: "15:00" },
      Tuesday: { working: true, start: "09:00", end: "21:00", break_start: "14:00", break_end: "15:00" },
      Wednesday: { working: true, start: "09:00", end: "21:00", break_start: "14:00", break_end: "15:00" },
      Thursday: { working: true, start: "09:00", end: "21:00", break_start: "14:00", break_end: "15:00" },
      Friday: { working: true, start: "09:00", end: "21:00", break_start: "14:00", break_end: "15:00" },
      Saturday: { working: true, start: "09:00", end: "22:00", break_start: "14:00", break_end: "15:00" },
      Sunday: { working: true, start: "09:00", end: "22:00", break_start: "14:00", break_end: "15:00" },
    },

    // Step 5: Capacity & Status
    maximum_concurrent_orders: 5,
    status: "active",
    availability_status: "ONLINE",

    // Step 6: Documents
    dl_number: "",
    rc_number: "",
    insurance_number: "",
    aadhaar_number: "",
    notes: "",
  });

  if (!isOpen) return null;

  const handleNext = () => {
    setErrorMsg(null);
    if (step === 1) {
      if (!formData.first_name.trim()) return setErrorMsg("First name is required.");
      if (!formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 10) {
        return setErrorMsg("Valid 10-digit phone number is required.");
      }
    }
    setStep((prev) => Math.min(7, prev + 1));
  };

  const handleBack = () => {
    setErrorMsg(null);
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const primaryBranch = branches.find((b: any) => b.id === formData.primary_branch_id) || branches[0] || { id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", name: "Indiranagar Flagship Kitchen", code: "HUB-BLR-01" };

      const associatedBranches = [
        { branch_id: primaryBranch.id, branch_name: primaryBranch.name, branch_code: primaryBranch.code || "HUB-BLR", is_primary: true, active: true, priority: 1 },
        ...formData.secondary_branch_ids.map((bId) => {
          const bObj = branches.find((b: any) => b.id === bId);
          return { branch_id: bId, branch_name: bObj?.name || "Hub", branch_code: bObj?.code || "HUB-BLR", is_primary: false, active: true, priority: 2 };
        }),
      ];

      const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        full_name: `${formData.first_name} ${formData.last_name}`.trim(),
        phone: formData.phone,
        alternate_phone: formData.alternate_phone,
        email: formData.email,
        date_of_birth: formData.date_of_birth,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        pincode: formData.pincode,

        emergency_contact_name: formData.emergency_contact_name,
        emergency_contact_relationship: formData.emergency_contact_relationship,
        emergency_contact_phone: formData.emergency_contact_phone,

        joining_date: new Date().toISOString().slice(0, 10),
        status: formData.status,
        availability_status: formData.availability_status,
        maximum_concurrent_orders: Number(formData.maximum_concurrent_orders),

        working_hours: formData.working_hours,

        primary_branch_id: primaryBranch.id,
        primary_branch_name: primaryBranch.name,
        associated_branches: associatedBranches,

        documents: {
          driving_license: { number: formData.dl_number || "DL-PENDING", expiry: "2032-12-31", status: "verified" },
          rc: { number: formData.rc_number || "RC-PENDING", status: "verified" },
          insurance: { number: formData.insurance_number || "INS-PENDING", expiry: "2027-01-01", status: "verified" },
          id_proof: { type: "Aadhaar", number: formData.aadhaar_number || "XXXX-XXXX-0000", status: "verified" },
        },

        notes: formData.notes,
      };

      const res = await apiClient.createAdminDeliveryPartner(payload);
      if (res?.partner) {
        onSuccess(res.partner);
        onClose();
      } else {
        setErrorMsg("Failed to register delivery partner.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "An error occurred during partner registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const stepsList = [
    { num: 1, title: "Profile", icon: User },
    { num: 2, title: "Branches", icon: Store },
    { num: 3, title: "Coverage", icon: MapPin },
    { num: 4, title: "Hours", icon: Clock },
    { num: 5, title: "Capacity", icon: ShieldCheck },
    { num: 6, title: "Documents", icon: ShieldCheck },
    { num: 7, title: "Review", icon: CheckCircle2 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between bg-slate-900 text-white">
          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-blue-400 uppercase">ENTERPRISE FLEET ONBOARDING WIZARD</span>
            <Heading level="h3" className="text-lg text-white">Register New Fleet Delivery Partner</Heading>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Stepper Progress */}
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b p-3 px-6 overflow-x-auto">
          <div className="flex items-center justify-between min-w-[600px]">
            {stepsList.map((s) => {
              const Icon = s.icon;
              const isActive = step === s.num;
              const isDone = step > s.num;
              return (
                <div key={s.num} className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    isDone ? "bg-emerald-600 text-white" : isActive ? "bg-blue-600 text-white ring-4 ring-blue-100 dark:ring-blue-900/40" : "bg-slate-200 dark:bg-slate-700 text-slate-500"
                  }`}>
                    {isDone ? "✓" : s.num}
                  </div>
                  <span className={`text-xs font-semibold ${isActive ? "text-blue-600 dark:text-blue-400 font-extrabold" : "text-slate-500"}`}>{s.title}</span>
                  {s.num < 8 && <div className="w-6 h-[2px] bg-slate-200 dark:bg-slate-700 mx-1" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 font-medium">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* STEP 1: PROFILE */}
          {step === 1 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 1 &bull; PERSONAL INFORMATION &amp; EMERGENCY CONTACT</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wiz_fname">First Name *</Label>
                  <Input id="wiz_fname" value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} placeholder="e.g. Suresh" required />
                </div>
                <div>
                  <Label htmlFor="wiz_lname">Last Name</Label>
                  <Input id="wiz_lname" value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} placeholder="e.g. Kumar" />
                </div>
                <div>
                  <Label htmlFor="wiz_phone">Primary Mobile Number *</Label>
                  <Input id="wiz_phone" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+91 98123 45678" required />
                </div>
                <div>
                  <Label htmlFor="wiz_alt_phone">Alternate Mobile Number</Label>
                  <Input id="wiz_alt_phone" value={formData.alternate_phone} onChange={(e) => setFormData({ ...formData, alternate_phone: e.target.value })} placeholder="+91 98123 00000" />
                </div>
                <div>
                  <Label htmlFor="wiz_email">Email Address</Label>
                  <Input id="wiz_email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="suresh.k@cakes2home.com" />
                </div>
                <div>
                  <Label htmlFor="wiz_dob">Date of Birth</Label>
                  <Input id="wiz_dob" type="date" value={formData.date_of_birth} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="wiz_address">Residential Address</Label>
                  <Input id="wiz_address" value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} placeholder="Flat / House / Street Address" />
                </div>
                <div>
                  <Label htmlFor="wiz_city">City</Label>
                  <Input id="wiz_city" value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="wiz_pincode">Pincode</Label>
                  <Input id="wiz_pincode" value={formData.pincode} onChange={(e) => setFormData({ ...formData, pincode: e.target.value })} />
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase">Emergency Contact</span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="wiz_e_name">Contact Person Name</Label>
                    <Input id="wiz_e_name" value={formData.emergency_contact_name} onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} placeholder="Anita Kumar" />
                  </div>
                  <div>
                    <Label htmlFor="wiz_e_rel">Relationship</Label>
                    <Input id="wiz_e_rel" value={formData.emergency_contact_relationship} onChange={(e) => setFormData({ ...formData, emergency_contact_relationship: e.target.value })} placeholder="Spouse" />
                  </div>
                  <div>
                    <Label htmlFor="wiz_e_phone">Contact Phone</Label>
                    <Input id="wiz_e_phone" value={formData.emergency_contact_phone} onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })} placeholder="+91 98123 00000" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: BRANCH ASSOCIATIONS */}
          {step === 2 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 2 &bull; BRANCH &amp; HUB NETWORK ASSOCIATIONS</span>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="wiz_p_branch">Primary Assigned Hub/Kitchen *</Label>
                  <Select value={formData.primary_branch_id} onValueChange={(val) => setFormData({ ...formData, primary_branch_id: val })}>
                    <Select.Trigger><Select.Value placeholder="Select Primary Hub" /></Select.Trigger>
                    <Select.Content>
                      {branches.map((b: any) => (
                        <Select.Item key={b.id} value={b.id}>{b.name} ({b.code || b.city || "HUB"})</Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl border space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase">Secondary Associated Hubs (Cross-Hub Dispatch)</span>
                  <Text className="text-xs text-slate-500 mb-2">Select additional hubs this partner can serve during peak hours or fallback dispatches.</Text>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {branches.filter((b: any) => b.id !== formData.primary_branch_id).map((b: any) => {
                      const isChecked = formData.secondary_branch_ids.includes(b.id);
                      return (
                        <label key={b.id} className="flex items-center gap-2 p-2 bg-white dark:bg-slate-800 rounded-lg border text-xs cursor-pointer hover:border-blue-400">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, secondary_branch_ids: [...formData.secondary_branch_ids, b.id] });
                              } else {
                                setFormData({ ...formData, secondary_branch_ids: formData.secondary_branch_ids.filter((id) => id !== b.id) });
                              }
                            }}
                            className="w-4 h-4 accent-blue-600 rounded"
                          />
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{b.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: INHERITED COVERAGE */}
          {step === 3 && (() => {
            const primaryBranch = branches.find((b: any) => b.id === formData.primary_branch_id) || branches[0] || { id: "", name: "No Branch Selected", code: "", city: "", pincode: "", pincodes: [] };
            const secondaryBranches = formData.secondary_branch_ids.map((id) => branches.find((b: any) => b.id === id)).filter(Boolean);
            const selectedBranchList = [primaryBranch, ...secondaryBranches].filter(Boolean);

            const derivedPincodesSet = new Set<string>();
            const derivedAreasSet = new Set<string>();

            selectedBranchList.forEach((b: any) => {
              if (b.pincode) derivedPincodesSet.add(b.pincode);
              if (Array.isArray(b.pincodes)) b.pincodes.forEach((p: string) => derivedPincodesSet.add(String(p).trim()));
              if (Array.isArray(b.applicable_pincodes)) b.applicable_pincodes.forEach((p: string) => derivedPincodesSet.add(String(p).trim()));
              if (Array.isArray(b.deliverable_areas)) b.deliverable_areas.forEach((a: string) => derivedAreasSet.add(String(a).trim()));
              if (Array.isArray(b.delivery_zones)) {
                b.delivery_zones.forEach((z: any) => {
                  if (Array.isArray(z.pincodes)) z.pincodes.forEach((p: string) => derivedPincodesSet.add(String(p).trim()));
                  if (Array.isArray(z.areas)) z.areas.forEach((a: string) => derivedAreasSet.add(String(a).trim()));
                });
              }
            });

            // Sample fallback mapping if branch object has light definitions
            // No pincodes derived — leave empty to signal unconfigured coverage

            const pList = Array.from(derivedPincodesSet);
            const aList = Array.from(derivedAreasSet);

            return (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 3 &bull; INHERITED DELIVERY COVERAGE</span>
                  <Text className="text-xs text-slate-500 mt-0.5">Delivery coverage is automatically inherited from the stores assigned to this partner.</Text>
                </div>

                {/* ASSIGNED STORES */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border space-y-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block uppercase tracking-wider">ASSIGNED STORES ({selectedBranchList.length})</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {selectedBranchList.map((b: any) => (
                      <div key={b.id} className="p-3 bg-white dark:bg-slate-800 rounded-lg border text-xs flex items-center justify-between shadow-sm">
                        <div>
                          <span className="font-extrabold text-slate-900 dark:text-white block">🏪 {b.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{b.code || "HUB"} &bull; {b.city || ""}</span>
                        </div>
                        {b.id === primaryBranch.id ? (
                          <Badge color="purple" className="text-[9px] uppercase font-bold">PRIMARY STORE</Badge>
                        ) : (
                          <Badge color="grey" className="text-[9px] uppercase font-bold">SECONDARY</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* EFFECTIVE INHERITED COVERAGE */}
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-xl border border-emerald-200 dark:border-emerald-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300 uppercase tracking-wider">EFFECTIVE DELIVERY COVERAGE</span>
                    <Badge color="green" className="text-[10px] uppercase font-extrabold">
                      ✓ Automatically inherited from stores
                    </Badge>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Pincodes ({pList.length} covered):
                      </span>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800 rounded-lg border max-h-24 overflow-y-auto">
                        {pList.map((p) => (
                          <span key={p} className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 rounded font-mono font-extrabold text-[11px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                        Locality Areas ({aList.length} covered):
                      </span>
                      <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800 rounded-lg border max-h-24 overflow-y-auto">
                        {aList.map((a) => (
                          <span key={a} className="px-2 py-0.5 bg-brand-light dark:bg-brand-navy/40 text-brand-navy dark:text-brand-primary/30 rounded font-semibold text-[11px]">
                            {a}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-emerald-800 dark:text-emerald-300 italic pt-1">
                    ℹ️ The delivery partner does not define custom pincodes. Coverage updates automatically whenever store delivery territories are modified in Store Settings.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* STEP 4: WORKING HOURS */}
          {step === 4 && (
            <div className="space-y-3">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 4 &bull; WEEKLY WORKING SHIFT HOURS &amp; BREAK SCHEDULE</span>
              <div className="border rounded-xl divide-y bg-white dark:bg-slate-800/40 overflow-hidden text-xs">
                {Object.keys(formData.working_hours).map((day) => {
                  const sched = (formData.working_hours as any)[day];
                  return (
                    <div key={day} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-800">
                      <div className="w-28 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={sched.working}
                          onChange={(e) => {
                            setFormData({
                              ...formData,
                              working_hours: {
                                ...formData.working_hours,
                                [day]: { ...sched, working: e.target.checked },
                              },
                            });
                          }}
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                        />
                        <span>{day}</span>
                      </div>
                      {sched.working ? (
                        <div className="flex items-center gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400">Shift:</span>
                            <input
                              type="time"
                              value={sched.start}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  working_hours: {
                                    ...formData.working_hours,
                                    [day]: { ...sched, start: e.target.value },
                                  },
                                });
                              }}
                              className="p-1 border rounded bg-slate-50 dark:bg-slate-900 font-mono text-xs"
                            />
                            <span>to</span>
                            <input
                              type="time"
                              value={sched.end}
                              onChange={(e) => {
                                setFormData({
                                  ...formData,
                                  working_hours: {
                                    ...formData.working_hours,
                                    [day]: { ...sched, end: e.target.value },
                                  },
                                });
                              }}
                              className="p-1 border rounded bg-slate-50 dark:bg-slate-900 font-mono text-xs"
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-rose-500 font-extrabold uppercase text-[10px]">OFF DAY</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: CAPACITY & STATUS */}
          {step === 5 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 5 &bull; MAXIMUM CONCURRENT CAPACITY &amp; OPERATIONAL STATUS</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wiz_max_orders">Maximum Concurrent Orders *</Label>
                  <Input
                    id="wiz_max_orders"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.maximum_concurrent_orders}
                    onChange={(e) => setFormData({ ...formData, maximum_concurrent_orders: Number(e.target.value) })}
                  />
                  <Text className="text-[11px] text-slate-500 mt-1">When active orders reach this threshold, partner becomes BUSY and auto-assignment pauses.</Text>
                </div>
                <div>
                  <Label htmlFor="wiz_avail">Initial Operational Availability</Label>
                  <Select value={formData.availability_status} onValueChange={(val) => setFormData({ ...formData, availability_status: val })}>
                    <Select.Trigger><Select.Value placeholder="Select Status" /></Select.Trigger>
                    <Select.Content>
                      <Select.Item value="ONLINE">ONLINE (Ready for Auto-Assignment)</Select.Item>
                      <Select.Item value="OFFLINE">OFFLINE (Not Available)</Select.Item>
                      <Select.Item value="ON_BREAK">ON BREAK</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: DOCUMENTS */}
          {step === 6 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wider block">STEP 6 &bull; COMPLIANCE &amp; DOCUMENT VERIFICATION</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="wiz_dl">Driving License Number</Label>
                  <Input id="wiz_dl" value={formData.dl_number} onChange={(e) => setFormData({ ...formData, dl_number: e.target.value })} placeholder="KA-01-20210098412" />
                </div>
                <div>
                  <Label htmlFor="wiz_rc">Vehicle RC Number</Label>
                  <Input id="wiz_rc" value={formData.rc_number} onChange={(e) => setFormData({ ...formData, rc_number: e.target.value })} placeholder="KA01EQ9941RC" />
                </div>
                <div>
                  <Label htmlFor="wiz_ins">Insurance Policy Number</Label>
                  <Input id="wiz_ins" value={formData.insurance_number} onChange={(e) => setFormData({ ...formData, insurance_number: e.target.value })} placeholder="INS-99882211" />
                </div>
                <div>
                  <Label htmlFor="wiz_aadhaar">Aadhaar / ID Proof Number</Label>
                  <Input id="wiz_aadhaar" value={formData.aadhaar_number} onChange={(e) => setFormData({ ...formData, aadhaar_number: e.target.value })} placeholder="XXXX-XXXX-8812" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="wiz_notes">Administrative Onboarding Notes</Label>
                  <Input id="wiz_notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Special qualifications, routing preferences, or internal notes..." />
                </div>
              </div>
            </div>
          )}

          {/* STEP 7: REVIEW */}
          {step === 7 && (
            <div className="space-y-4">
              <span className="text-xs font-extrabold text-emerald-600 uppercase tracking-wider block">STEP 7 &bull; FINAL REVIEW &amp; AUTHORIZATION</span>
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 rounded-xl space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
                  <span className="font-extrabold text-emerald-900 dark:text-emerald-200 text-sm">Partner Full Profile Summary</span>
                  <span className="bg-emerald-200 text-emerald-900 font-mono font-bold text-[10px] px-2 py-0.5 rounded uppercase">READY TO ONBOARD</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-emerald-900 dark:text-emerald-200">
                  <div>
                    <p><span className="font-bold text-emerald-700">Full Name:</span> {formData.first_name} {formData.last_name}</p>
                    <p><span className="font-bold text-emerald-700">Mobile Phone:</span> {formData.phone}</p>
                    <p><span className="font-bold text-emerald-700">Email:</span> {formData.email || "N/A"}</p>
                    <p><span className="font-bold text-emerald-700">City / Pincode:</span> {formData.city} - {formData.pincode}</p>
                  </div>
                  <div>
                    <p><span className="font-bold text-emerald-700">Primary Store:</span> {branches.find((b: any) => b.id === formData.primary_branch_id)?.name || "Indiranagar Kitchen"}</p>
                    <p><span className="font-bold text-emerald-700">Max Capacity:</span> {formData.maximum_concurrent_orders} concurrent orders</p>
                    <p><span className="font-bold text-emerald-700">Status:</span> {formData.status}</p>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200 text-emerald-950 dark:text-emerald-200">
                  <p><span className="font-bold text-emerald-700">Delivery Territory:</span> Automatically inherited from assigned store(s)</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-4 border-t bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between">
          <Button variant="secondary" onClick={step === 1 ? onClose : handleBack}>
            {step === 1 ? "Cancel" : "Back"}
          </Button>

          {step < 7 ? (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6">
              Next Step &rarr;
            </Button>
          ) : (
            <Button onClick={handleSubmit} isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold px-8">
              ✓ Authorize &amp; Register Partner
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
