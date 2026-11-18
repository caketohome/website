"use client";

import { useEffect, useState } from "react";
import { Heading, Text, Badge, Button, Input, Label, Select } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import { X, User, Phone, Mail, MapPin, Store, Clock, ShieldCheck, Truck, Star, Award, History, Activity, AlertCircle } from "lucide-react";

interface DrawerProps {
  partnerId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onSelectOrder?: (orderId: string) => void;
  branches: any[];
}

export function DeliveryPartnerDetailsDrawer({ partnerId, isOpen, onClose, onRefresh, onSelectOrder, branches }: DrawerProps) {
  const [details, setDetails] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  const [updating, setUpdating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // Edit Mode state
  const [editAvailability, setEditAvailability] = useState("ONLINE");
  const [editStatus, setEditStatus] = useState("active");
  const [editPrimaryBranch, setEditPrimaryBranch] = useState("");
  const [editNotes, setEditNotes] = useState("");

  useEffect(() => {
    if (!partnerId || !isOpen) return;
    setLoading(true);
    setMsg(null);

    apiClient.getDeliveryPartnerDetails(partnerId)
      .then((res: any) => {
        const p = res?.partner || res;
        setDetails(res);
        if (p) {
          setEditAvailability(p.availability_status || "ONLINE");
          setEditStatus(p.status || "active");
          setEditPrimaryBranch(p.primary_branch_id || branches[0]?.id || "");
          setEditNotes(p.notes || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load partner details:", err);
      })
      .finally(() => setLoading(false));
  }, [partnerId, isOpen, branches]);

  if (!isOpen || !partnerId) return null;

  const partner = details?.partner;
  const activeOrders = details?.active_orders || [];
  const historyList = details?.delivery_history || [];
  const assignmentLog = details?.assignment_history || [];
  const auditLogs = details?.audit_logs || [];

  const handleUpdateAvailability = async (newStatus: string) => {
    setUpdating(true);
    setMsg(null);
    try {
      await apiClient.updatePartnerAvailability(partner.id, newStatus, "Super Admin Drawer Toggle");
      setEditAvailability(newStatus);
      setMsg(`✓ Availability status updated to ${newStatus}`);
      onRefresh();
    } catch (err: any) {
      setMsg(`⚠️ ${err.message || 'Failed to update availability'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Are you sure you want to deactivate Delivery Partner ${partner.partner_number}?`)) return;
    setUpdating(true);
    try {
      await apiClient.deactivateAdminDeliveryPartner(partner.id, "Deactivated via Admin Drawer");
      setMsg(`✓ Partner ${partner.partner_number} deactivated.`);
      onRefresh();
    } catch (err: any) {
      setMsg(`⚠️ ${err.message || 'Deactivation failed'}`);
    } finally {
      setUpdating(false);
    }
  };

  const handleSaveProfileUpdates = async () => {
    setUpdating(true);
    setMsg(null);
    try {
      const primaryBranchObj = branches.find((b: any) => b.id === editPrimaryBranch);

      await apiClient.updateAdminDeliveryPartner(partner.id, {
        status: editStatus,
        primary_branch_id: editPrimaryBranch,
        primary_branch_name: primaryBranchObj?.name || partner.primary_branch_name,
        notes: editNotes,
      });

      setMsg("✓ Partner profile updated successfully!");
      onRefresh();
    } catch (err: any) {
      setMsg(`⚠️ ${err.message || 'Update failed'}`);
    } finally {
      setUpdating(false);
    }
  };

  const tabs = [
    { id: "profile", label: "1. Profile Overview", icon: User },
    { id: "contact", label: "2. Contact & Emergency", icon: Phone },
    { id: "branches", label: "3. Branches & Hubs", icon: Store },
    { id: "hours", label: "4. Working Hours", icon: Clock },
    { id: "availability", label: "5. Availability Controls", icon: Activity },
    { id: "coverage", label: "6. Coverage Areas", icon: MapPin },
    { id: "documents", label: "7. Documents", icon: ShieldCheck },
    { id: "performance", label: "8. Performance Metrics", icon: Award },
    { id: "active_orders", label: `9. Active Orders (${activeOrders.length})`, icon: Truck },
    { id: "history", label: `10. Delivery History (${historyList.length})`, icon: History },
    { id: "assignments", label: `11. Assignment Log (${assignmentLog.length})`, icon: Activity },
    { id: "audit", label: `12. Audit Trail (${auditLogs.length})`, icon: ShieldCheck },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm overflow-hidden">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl h-full shadow-2xl border-l flex flex-col overflow-hidden">
        {/* Drawer Header */}
        <div className="p-5 border-b bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={partner?.profile_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"} className="w-12 h-12 rounded-full object-cover border-2 border-blue-400" alt="Avatar" />
            <div>
              <div className="flex items-center gap-2">
                <Heading level="h3" className="text-base text-white">{partner?.full_name || partner?.name}</Heading>
                <Badge color="purple" className="font-mono text-[10px]">{partner?.partner_number || "CTH-DP-000001"}</Badge>
              </div>
              <p className="text-xs text-slate-300 flex items-center gap-2 mt-0.5">
                <span>{partner?.primary_branch_name}</span> &bull;
                <span>{partner?.phone}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="bg-slate-50 dark:bg-slate-800/60 border-b overflow-x-auto p-2 flex gap-1 text-xs font-semibold">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1.5 transition-colors ${
                activeTab === t.id ? "bg-blue-600 text-white font-extrabold shadow" : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        {/* Drawer Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {msg && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-blue-900 dark:text-blue-200 text-xs rounded-xl flex items-center justify-between">
              <span>{msg}</span>
              <button onClick={() => setMsg(null)} className="text-blue-500 hover:underline">Dismiss</button>
            </div>
          )}

          {loading ? (
            <div className="p-12 text-center text-xs text-slate-400 animate-pulse">Loading partner profile...</div>
          ) : !partner ? (
            <div className="p-12 text-center text-xs text-rose-500">Partner record not found.</div>
          ) : (
            <>
              {/* TAB 1: PROFILE OVERVIEW */}
              {activeTab === "profile" && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Account Status</span>
                      <Badge color={partner.status === "active" ? "green" : "red"} className="text-[10px] uppercase font-bold mt-1">
                        {partner.status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Availability Status</span>
                      <Badge color={partner.availability_status === "ONLINE" ? "green" : partner.availability_status === "BUSY" ? "orange" : "grey"} className="text-[10px] uppercase font-extrabold mt-1">
                        {partner.availability_status}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Joining Date</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">{partner.joining_date}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Rating</span>
                      <p className="font-bold text-slate-900 dark:text-white">⭐ {partner.rating || "5.0"}</p>
                    </div>
                  </div>

                  <div className="space-y-3 pt-2">
                    <Label htmlFor="ed_notes">Administrative Profile Notes</Label>
                    <Input id="ed_notes" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Enter administrative notes..." />
                    <Button size="small" onClick={handleSaveProfileUpdates} isLoading={updating} className="bg-blue-600 text-white">
                      Save Profile Changes
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 2: CONTACT & EMERGENCY */}
              {activeTab === "contact" && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 border rounded-2xl bg-white dark:bg-slate-800/40 space-y-2">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">PERSONAL CONTACT DETAILS</span>
                    <p><span className="font-bold text-slate-500">Phone:</span> {partner.phone}</p>
                    <p><span className="font-bold text-slate-500">Alternate Phone:</span> {partner.alternate_phone || "Not specified"}</p>
                    <p><span className="font-bold text-slate-500">Email:</span> {partner.email}</p>
                    <p><span className="font-bold text-slate-500">Address:</span> {partner.address}</p>
                    <p><span className="font-bold text-slate-500">City / Pincode:</span> {partner.city} - {partner.pincode}</p>
                  </div>

                  <div className="p-4 border rounded-2xl bg-brand-gold-light/50 dark:bg-brand-gold-dark/20 space-y-2">
                    <span className="text-[10px] font-extrabold text-brand-gold-dark dark:text-brand-gold uppercase tracking-wider block">EMERGENCY CONTACT</span>
                    <p><span className="font-bold text-brand-gold-dark dark:text-brand-gold">Name:</span> {partner.emergency_contact_name || "Emergency Contact"}</p>
                    <p><span className="font-bold text-brand-gold-dark dark:text-brand-gold">Relationship:</span> {partner.emergency_contact_relationship || "Relative"}</p>
                    <p><span className="font-bold text-brand-gold-dark dark:text-brand-gold">Phone:</span> {partner.emergency_contact_phone || partner.phone}</p>
                  </div>
                </div>
              )}

              {/* TAB 3: BRANCHES */}
              {activeTab === "branches" && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 border rounded-2xl space-y-3">
                    <span className="text-[10px] font-extrabold text-brand-primary uppercase tracking-wider block">PRIMARY &amp; SECONDARY ASSOCIATED KITCHEN HUBS</span>
                    <div className="space-y-2">
                      <Label>Primary Assigned Kitchen Hub</Label>
                      <Select value={editPrimaryBranch} onValueChange={(val) => setEditPrimaryBranch(val)}>
                        <Select.Trigger><Select.Value placeholder="Select Primary Hub" /></Select.Trigger>
                        <Select.Content>
                          {branches.map((b: any) => (
                            <Select.Item key={b.id} value={b.id}>{b.name} ({b.code || "HUB"})</Select.Item>
                          ))}
                        </Select.Content>
                      </Select>
                      <Button size="small" onClick={handleSaveProfileUpdates} isLoading={updating} className="mt-2 bg-brand-primary text-white">
                        Update Branch Network
                      </Button>
                    </div>

                    <div className="pt-3 border-t">
                      <span className="font-bold text-slate-500 block mb-2">Associated Branch Network:</span>
                      <div className="space-y-1.5">
                        {(partner.associated_branches || []).map((b: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border flex items-center justify-between">
                            <div>
                              <p className="font-extrabold text-slate-900 dark:text-white">{b.branch_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{b.branch_code || b.branch_id}</p>
                            </div>
                            <Badge color={b.is_primary ? "purple" : "grey"} className="text-[9px]">
                              {b.is_primary ? "PRIMARY HUB" : "SECONDARY"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: WORKING HOURS */}
              {activeTab === "hours" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">WEEKLY SHIFT SCHEDULE &amp; BREAKS</span>
                  <div className="border rounded-2xl divide-y bg-white dark:bg-slate-800/40">
                    {Object.keys(partner.working_hours || {}).map((day) => {
                      const sched = partner.working_hours[day];
                      return (
                        <div key={day} className="p-3 flex items-center justify-between">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{day}</span>
                          {sched?.working ? (
                            <div className="flex items-center gap-2 font-mono text-slate-600 dark:text-slate-300">
                              <span>Shift: {sched.start} – {sched.end}</span>
                              {sched.break_start && <span className="text-[10px] text-slate-400">(Break: {sched.break_start}-{sched.break_end})</span>}
                            </div>
                          ) : (
                            <Badge color="red" className="text-[9px]">OFF DAY</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 5: AVAILABILITY CONTROLS */}
              {activeTab === "availability" && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 border rounded-2xl bg-white dark:bg-slate-800/40 space-y-3">
                    <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">OPERATIONAL AVAILABILITY CONTROLS</span>
                    <p className="text-slate-600 dark:text-slate-300">
                      Switch partner operational readiness status. Current status: <Badge color={partner.availability_status === "ONLINE" ? "green" : "grey"} className="font-mono uppercase">{partner.availability_status}</Badge>
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2">
                      {["ONLINE", "OFFLINE", "ON_BREAK", "BUSY"].map((st) => (
                        <Button
                          key={st}
                          size="small"
                          variant={editAvailability === st ? "primary" : "secondary"}
                          onClick={() => handleUpdateAvailability(st)}
                          isLoading={updating}
                          className="text-xs font-bold"
                        >
                          {st}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="p-4 border border-rose-200 bg-rose-50/50 dark:bg-rose-950/20 rounded-2xl space-y-2">
                    <span className="text-[10px] font-extrabold text-rose-700 dark:text-rose-300 uppercase tracking-wider block">ACCOUNT DEACTIVATION</span>
                    <p className="text-rose-800 dark:text-rose-200">Deactivating a partner prevents new automatic order assignments while preserving historical delivery records.</p>
                    <Button size="small" variant="secondary" onClick={handleDeactivate} isLoading={updating} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                      Deactivate Delivery Partner
                    </Button>
                  </div>
                </div>
              )}

              {/* TAB 6: COVERAGE AREAS */}
              {activeTab === "coverage" && (
                <div className="space-y-4 text-xs">
                  <div className="p-4 border rounded-2xl bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">DELIVERY COVERAGE</span>
                        <Text className="text-xs text-slate-500 font-medium">Inherited automatically from assigned stores</Text>
                      </div>
                      <Badge color="green" className="text-[9px] uppercase font-bold">
                        STORE INHERITED
                      </Badge>
                    </div>

                    <div className="space-y-3">
                      <p><span className="font-bold text-slate-700 dark:text-slate-300">Primary Store:</span> <span className="font-semibold text-brand-primary">{partner.primary_branch_name || "Indiranagar Flagship Kitchen"}</span></p>

                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Covered Pincodes ({(partner.coverage?.pincodes || []).length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800 rounded-xl border max-h-32 overflow-y-auto font-mono">
                          {(partner.coverage?.pincodes || []).map((p: string, idx: number) => (
                            <span key={idx} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded font-bold text-[11px] border border-blue-200">
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">
                          Covered Areas ({(partner.coverage?.areas || []).length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5 p-2.5 bg-white dark:bg-slate-800 rounded-xl border max-h-32 overflow-y-auto">
                          {(partner.coverage?.areas || []).map((area: string, idx: number) => (
                            <Badge key={idx} color="purple" className="text-[10px]">{area}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t text-[11px] text-slate-500 italic">
                      ℹ️ Coverage is managed by the assigned store/branch. Change the partner's associated stores to change their delivery territory.
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: DOCUMENTS */}
              {activeTab === "documents" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">VERIFIED COMPLIANCE DOCUMENTS</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.keys(partner.documents || {}).map((docKey) => {
                      const doc = partner.documents[docKey];
                      return (
                        <div key={docKey} className="p-3 border rounded-xl bg-white dark:bg-slate-800/40 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-slate-800 dark:text-slate-200 capitalize">{docKey.replace(/_/g, " ")}</span>
                            <p className="text-[11px] font-mono text-slate-500">{doc.number}</p>
                          </div>
                          <Badge color="green" className="text-[9px] uppercase font-bold">{doc.status}</Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 9: PERFORMANCE */}
              {activeTab === "performance" && (
                <div className="space-y-4 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">HISTORICAL DELIVERIES &amp; METRICS</span>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border rounded-xl text-center">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Deliveries</span>
                      <span className="text-xl font-extrabold text-slate-900 dark:text-white">{partner.total_deliveries || 0}</span>
                    </div>
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 text-center">
                      <span className="text-[10px] text-emerald-700 font-bold block uppercase">Successful</span>
                      <span className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200">{partner.successful_deliveries || 0}</span>
                    </div>
                    <div className="p-3 bg-brand-gold-light dark:bg-brand-gold-dark/40 border border-brand-gold/40 text-center">
                      <span className="text-[10px] text-brand-gold-dark font-bold block uppercase">Rating</span>
                      <span className="text-xl font-extrabold text-brand-gold-dark dark:text-brand-gold">⭐ {partner.rating || "5.0"}</span>
                    </div>
                    <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 text-center">
                      <span className="text-[10px] text-blue-700 font-bold block uppercase">Active Workload</span>
                      <span className="text-xl font-extrabold text-blue-800 dark:text-blue-200">{partner.current_active_orders || 0} / {partner.maximum_concurrent_orders || 5}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 10: ACTIVE ORDERS */}
              {activeTab === "active_orders" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">CURRENT ACTIVE DISPATCH ORDERS</span>
                  {activeOrders.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border rounded-2xl bg-slate-50/50">No active assigned orders.</div>
                  ) : (
                    <div className="space-y-2">
                      {activeOrders.map((o: any) => (
                        <div
                          key={o.id}
                          onClick={() => onSelectOrder?.(o.id)}
                          className="p-3 border rounded-xl bg-white dark:bg-slate-800 hover:border-blue-400 cursor-pointer flex items-center justify-between"
                        >
                          <div>
                            <p className="font-extrabold text-blue-600">{o.order_number}</p>
                            <p className="text-slate-600 dark:text-slate-300">{o.customer_name} &bull; {o.shipping_address?.area || o.shipping_address?.city}</p>
                          </div>
                          <div className="text-right">
                            <Badge color="blue" className="text-[9px] uppercase font-bold">{o.status}</Badge>
                            <p className="text-[10px] text-slate-400 font-mono mt-0.5">₹{o.total}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 11: DELIVERY HISTORY */}
              {activeTab === "history" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">COMPLETED DELIVERIES LOG</span>
                  {historyList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border rounded-2xl bg-slate-50/50">No completed delivery history.</div>
                  ) : (
                    <div className="space-y-2">
                      {historyList.map((o: any) => (
                        <div key={o.id} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{o.order_number}</p>
                            <p className="text-slate-500">{o.customer_name} &bull; {o.delivery_date}</p>
                          </div>
                          <Badge color="green" className="text-[9px] uppercase">{o.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 12: ASSIGNMENT LOG */}
              {activeTab === "assignments" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">AUTOMATIC &amp; MANUAL ASSIGNMENT AUDIT LOG</span>
                  {assignmentLog.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border rounded-2xl bg-slate-50/50">No assignment history entries.</div>
                  ) : (
                    <div className="space-y-2">
                      {assignmentLog.map((a: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-xl bg-white dark:bg-slate-800 font-mono text-[11px]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-blue-600">{a.order_number}</span>
                            <Badge color={a.assignment_mode === "auto" ? "green" : "purple"} className="text-[9px] uppercase">
                              {a.assignment_mode}
                            </Badge>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300">&ldquo;{a.reason}&rdquo;</p>
                          <span className="text-[10px] text-slate-400 block mt-1">{new Date(a.timestamp).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 13: AUDIT TRAIL */}
              {activeTab === "audit" && (
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wider block">PERSISTENT SYSTEM AUDIT TRAIL</span>
                  {auditLogs.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 border rounded-2xl bg-slate-50/50">No system audit logs for this partner.</div>
                  ) : (
                    <div className="space-y-2">
                      {auditLogs.map((log: any, idx: number) => (
                        <div key={idx} className="p-3 border rounded-xl bg-slate-50 dark:bg-slate-800/40 text-[11px]">
                          <p className="font-semibold text-slate-800 dark:text-slate-200">{log.action}</p>
                          <span className="text-[10px] text-slate-400 block mt-1">{new Date(log.timestamp || log.created_at).toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
