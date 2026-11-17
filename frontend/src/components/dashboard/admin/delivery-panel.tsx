"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label, Select } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import dynamic from "next/dynamic";
import { Plus, RefreshCw, Truck, Search, Filter, ShieldCheck, Settings, Eye, Power, CheckCircle2, AlertCircle, Clock, X } from "lucide-react";

const DeliveryCoverageMap = dynamic(
  () => import("@frontend/components/store/coverage-map").then((m) => m.DeliveryCoverageMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-80 rounded-2xl bg-ui-bg-subtle border border-ui-border-base flex items-center justify-center text-xs text-ui-fg-muted animate-pulse">
        Loading coverage map...
      </div>
    ),
  }
);

import { WidgetErrorBoundary } from "./error-boundary";
import { TableSkeleton } from "./admin-skeletons";
import { DeliveryPartnerWizard } from "./delivery-partner-wizard";
import { DeliveryPartnerDetailsDrawer } from "./delivery-partner-details-drawer";

export const DeliveryPanel = memo(function DeliveryPanel() {
  const [partners, setPartners] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Drawers state
  const [showWizard, setShowWizard] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterBranch, setFilterBranch] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAvailability, setFilterAvailability] = useState("all");
  const [filterWorkingNow, setFilterWorkingNow] = useState(false);

  // Assignment Rules State
  const [rules, setRules] = useState<any>({
    allow_cross_branch_fallback: false,
    require_working_hours: true,
    require_online_status: true,
    max_capacity_limit: 5,
  });
  const [savingRules, setSavingRules] = useState(false);

  const fetchBranches = useCallback(() => {
    apiClient.getEligibleBranches({})
      .then((res: any) => {
        setBranches(res?.branches || res || []);
      })
      .catch(() => {
        setBranches([
          { id: "res_01KXYMAHGFPRY1G9TZKEVGAGAT", name: "Indiranagar Flagship Kitchen", code: "HUB-BLR-01" },
          { id: "res_02KXYMAHGFPRY1G9TZKEVGAGAT", name: "Koramangala Gourmet Bakery", code: "HUB-BLR-02" },
          { id: "res_03KXYMAHGFPRY1G9TZKEVGAGAT", name: "Whitefield Central Kitchen", code: "HUB-BLR-03" },
        ]);
      });
  }, []);

  const fetchPartners = useCallback(() => {
    setLoading(true);
    setError(null);

    const params: Record<string, any> = {};
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (filterBranch !== "all") params.branch_id = filterBranch;
    if (filterStatus !== "all") params.status = filterStatus;
    if (filterAvailability !== "all") params.availability = filterAvailability;
    if (filterWorkingNow) params.working_now = "true";

    apiClient.getAdminDeliveryPartners(params)
      .then((r: any) => {
        setPartners(r?.partners || r?.deliveries || []);
      })
      .catch((err) => {
        console.error("[Delivery Panel Error] Failed to fetch delivery partners:", err);
        setError(err.message || "Failed to load delivery partners");
        setPartners([]);
      })
      .finally(() => setLoading(false));
  }, [searchQuery, filterBranch, filterStatus, filterAvailability, filterWorkingNow]);

  const fetchRules = useCallback(() => {
    apiClient.getDeliveryAssignmentRules()
      .then((res: any) => {
        if (res?.rules || res) setRules(res.rules || res);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBranches();
    fetchRules();
  }, [fetchBranches, fetchRules]);

  useEffect(() => {
    fetchPartners();
  }, [fetchPartners]);

  const handleToggleAvailability = async (partnerId: string, currentAvail: string) => {
    const nextAvail = currentAvail === "ONLINE" ? "OFFLINE" : "ONLINE";
    try {
      await apiClient.updatePartnerAvailability(partnerId, nextAvail, "Admin Table Quick Toggle");
      fetchPartners();
    } catch (err: any) {
      alert(err.message || "Failed to update availability");
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      await apiClient.updateDeliveryAssignmentRules(rules);
      setShowRulesModal(false);
      alert("✓ Delivery Assignment Engine configuration rules updated successfully.");
    } catch (err: any) {
      alert(err.message || "Failed to save assignment rules.");
    } finally {
      setSavingRules(false);
    }
  };

  // Compute fleet KPI counts
  const totalFleet = partners.length;
  const onlineCount = partners.filter((p: any) => p.availability_status === "ONLINE").length;
  const busyCount = partners.filter((p: any) => p.availability_status === "BUSY" || (p.current_active_orders || 0) > 0).length;
  const inactiveCount = partners.filter((p: any) => p.status === "inactive" || p.status === "suspended").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Heading level="h2" className="text-xl">Enterprise Delivery Partner Management &amp; Fleet Operations</Heading>
            <Badge color="purple" className="font-mono text-xs font-bold">CTH-DISPATCH-V2</Badge>
          </div>
          <Text className="text-ui-fg-subtle text-sm">
            Manage onboarding, branch associations, working shifts, inherited coverage, and backend automatic rider dispatch engine.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button size="small" variant="secondary" onClick={() => setShowRulesModal(true)} className="flex items-center gap-1.5 text-xs">
            <Settings className="w-3.5 h-3.5" /> Assignment Rules
          </Button>
          <Button size="small" variant="secondary" onClick={fetchPartners} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="small" onClick={() => setShowWizard(true)} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold">
            <Plus className="w-4 h-4" /> Register Delivery Partner
          </Button>
        </div>
      </div>

      {/* Fleet KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white dark:bg-slate-800 rounded-2xl border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Fleet</span>
            <span className="text-2xl font-extrabold text-slate-900 dark:text-white">{totalFleet}</span>
          </div>
          <Truck className="w-8 h-8 text-blue-600 opacity-75" />
        </div>

        <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/20 rounded-2xl border border-emerald-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">ONLINE &amp; Ready</span>
            <span className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200">{onlineCount}</span>
          </div>
          <CheckCircle2 className="w-8 h-8 text-emerald-600 opacity-80" />
        </div>

        <div className="p-4 bg-brand-gold-light/60 dark:bg-brand-gold-dark/20 rounded-2xl border border-brand-gold/40 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-brand-gold-dark dark:text-brand-gold/40 uppercase tracking-wider block">On Active Delivery / Busy</span>
            <span className="text-2xl font-extrabold text-brand-gold-dark dark:text-brand-gold/40">{busyCount}</span>
          </div>
          <Clock className="w-8 h-8 text-brand-gold opacity-80" />
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Inactive / Deactivated</span>
            <span className="text-2xl font-extrabold text-slate-500">{inactiveCount}</span>
          </div>
          <Power className="w-8 h-8 text-slate-400 opacity-60" />
        </div>
      </div>

      {/* Multi-Filter & Search Bar */}
      <Container className="p-4 bg-white dark:bg-slate-900 rounded-2xl border shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Partner ID (CTH-DP-XXXXXX), Name, Phone, Email, Branch, Pincode..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
            {/* Branch Filter */}
            <Select value={filterBranch} onValueChange={(val) => setFilterBranch(val)}>
              <Select.Trigger className="text-xs min-w-[150px]"><Select.Value placeholder="Branch: All" /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Branch: All Hubs</Select.Item>
                {branches.map((b: any) => (
                  <Select.Item key={b.id} value={b.id}>{b.name}</Select.Item>
                ))}
              </Select.Content>
            </Select>

            {/* Account Status Filter */}
            <Select value={filterStatus} onValueChange={(val) => setFilterStatus(val)}>
              <Select.Trigger className="text-xs min-w-[130px]"><Select.Value placeholder="Account: All" /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Account: All</Select.Item>
                <Select.Item value="active">Active Only</Select.Item>
                <Select.Item value="inactive">Inactive Only</Select.Item>
                <Select.Item value="suspended">Suspended Only</Select.Item>
              </Select.Content>
            </Select>

            {/* Availability Filter */}
            <Select value={filterAvailability} onValueChange={(val) => setFilterAvailability(val)}>
              <Select.Trigger className="text-xs min-w-[140px]"><Select.Value placeholder="Availability: All" /></Select.Trigger>
              <Select.Content>
                <Select.Item value="all">Availability: All</Select.Item>
                <Select.Item value="ONLINE">ONLINE Only</Select.Item>
                <Select.Item value="OFFLINE">OFFLINE Only</Select.Item>
                <Select.Item value="ON_BREAK">ON BREAK Only</Select.Item>
                <Select.Item value="BUSY">BUSY Only</Select.Item>
              </Select.Content>
            </Select>

            {/* Shift Working Now Checkbox */}
            <label className="flex items-center gap-1.5 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer hover:bg-slate-200">
              <input
                type="checkbox"
                checked={filterWorkingNow}
                onChange={(e) => setFilterWorkingNow(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded"
              />
              <span>In Shift Now</span>
            </label>
          </div>
        </div>
      </Container>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchPartners}>Retry Fetch</Button>
        </div>
      )}

      {/* Expanded Production Partner Table */}
      <WidgetErrorBoundary moduleName="Delivery Fleet Table" onRetry={fetchPartners} compact>
        {loading ? (
          <TableSkeleton rows={6} cols={10} />
        ) : (
          <Container className="p-0 overflow-hidden shadow-sm border rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b bg-slate-900 text-white font-bold tracking-wider">
                    <th className="p-3.5 whitespace-nowrap">Partner ID</th>
                    <th className="p-3.5 whitespace-nowrap">Rider Identity</th>
                    <th className="p-3.5 whitespace-nowrap">Contact</th>
                    <th className="p-3.5 whitespace-nowrap">Primary Hub / Branch</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Account Status</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Live Availability</th>
                    <th className="p-3.5 whitespace-nowrap">Coverage Pincodes</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Active Load</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Deliveries</th>
                    <th className="p-3.5 whitespace-nowrap text-center">Rating</th>
                    <th className="p-3.5 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {partners.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-12 text-center text-slate-400">
                        No delivery partners found matching current filters.
                      </td>
                    </tr>
                  ) : (
                    partners.map((p: any) => {
                      const isOnline = p.availability_status === "ONLINE";
                      const isAccountActive = p.status === "active";
                      const partnerName = p.full_name || p.name || `${p.first_name || "Driver"} ${p.last_name || ""}`.trim();
                      const partnerNum = p.partner_number || p.id || "CTH-DP-000000";

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                          {/* Partner ID */}
                          <td className="p-3.5 font-mono font-bold text-blue-600 whitespace-nowrap">
                            {partnerNum}
                          </td>

                          {/* Rider Identity */}
                          <td className="p-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={p.profile_photo || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200"}
                                className="w-8 h-8 rounded-full object-cover border"
                                alt="Rider"
                              />
                              <div>
                                <span className="font-extrabold text-slate-900 dark:text-white block">{partnerName}</span>
                                <span className="text-[10px] text-slate-400">Joined {p.joining_date || "2024"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Contact */}
                          <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                            <div>{p.phone}</div>
                            <div className="text-[10px] text-slate-400">{p.city || ""}</div>
                          </td>

                          {/* Primary Hub */}
                          <td className="p-3.5 whitespace-nowrap">
                            <span className="font-bold text-slate-800 dark:text-slate-200 block">{p.primary_branch_name || "—"}</span>
                            {(p.associated_branches?.length > 1) && (
                              <span className="text-[10px] text-brand-primary font-semibold block">+{p.associated_branches.length - 1} secondary hub(s)</span>
                            )}
                          </td>

                          {/* Account Status */}
                          <td className="p-3.5 whitespace-nowrap text-center">
                            <Badge color={isAccountActive ? "green" : "red"} className="text-[9px] uppercase font-extrabold">
                              {p.status || "active"}
                            </Badge>
                          </td>

                          {/* Live Availability Toggle */}
                          <td className="p-3.5 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleToggleAvailability(p.id, p.availability_status)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase transition-all shadow-sm flex items-center gap-1 mx-auto ${
                                isOnline
                                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                  : p.availability_status === "BUSY"
                                  ? "bg-brand-gold text-white hover:bg-brand-gold"
                                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300"
                              }`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-white animate-ping" : "bg-slate-400"}`} />
                              {p.availability_status || "OFFLINE"}
                            </button>
                          </td>

                          {/* Coverage Pincodes */}
                          <td className="p-3.5 whitespace-nowrap font-mono text-[10px]">
                            {(p.coverage?.pincodes || [p.pincode || "560038"]).slice(0, 3).join(", ")}
                            {(p.coverage?.pincodes?.length > 3) && ` (+${p.coverage.pincodes.length - 3})`}
                          </td>

                          {/* Active Load */}
                          <td className="p-3.5 whitespace-nowrap text-center font-bold">
                            <span className={p.current_active_orders > 0 ? "text-blue-600 font-extrabold" : "text-slate-400"}>
                              {p.current_active_orders || 0} / {p.maximum_concurrent_orders || 5}
                            </span>
                          </td>

                          {/* Deliveries */}
                          <td className="p-3.5 whitespace-nowrap text-center font-mono">
                            <span className="font-bold text-slate-800 dark:text-slate-200">{p.total_deliveries || 0}</span>
                          </td>

                          {/* Rating */}
                          <td className="p-3.5 whitespace-nowrap text-center font-bold text-brand-gold">
                            ⭐ {p.rating || "5.0"}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 whitespace-nowrap text-right">
                            <Button
                              size="small"
                              variant="secondary"
                              onClick={() => setSelectedPartnerId(p.id)}
                              className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-800"
                            >
                              <Eye className="w-3.5 h-3.5" /> View Profile
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Container>
        )}
      </WidgetErrorBoundary>

      {/* Embedded Delivery Coverage Map */}
      <WidgetErrorBoundary moduleName="Delivery Coverage Map Widget" compact>
        <div className="mt-4 pt-4 border-t border-ui-border-base">
          <DeliveryCoverageMap />
        </div>
      </WidgetErrorBoundary>

      {/* Multi-Step Onboarding Wizard Modal */}
      <DeliveryPartnerWizard
        isOpen={showWizard}
        onClose={() => setShowWizard(false)}
        onSuccess={(newPartner) => {
          fetchPartners();
          setSelectedPartnerId(newPartner.id);
        }}
        branches={branches}
      />

      {/* Partner 13-Tab Details Profile Drawer */}
      <DeliveryPartnerDetailsDrawer
        partnerId={selectedPartnerId}
        isOpen={Boolean(selectedPartnerId)}
        onClose={() => setSelectedPartnerId(null)}
        onRefresh={fetchPartners}
        branches={branches}
      />

      {/* Assignment Rules Engine Configuration Modal */}
      {showRulesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border w-full max-w-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-600" />
                <Heading level="h3" className="text-base">Automatic Rider Assignment Engine Configuration</Heading>
              </div>
              <button onClick={() => setShowRulesModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <label className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Require ONLINE Availability Status</span>
                  <span className="text-[11px] text-slate-500">Only dispatch orders to partners with availability_status = ONLINE.</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.require_online_status}
                  onChange={(e) => setRules({ ...rules, require_online_status: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Enforce Daily Shift Working Hours</span>
                  <span className="text-[11px] text-slate-500">Verify local branch time falls within partner's weekly shift schedule.</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.require_working_hours}
                  onChange={(e) => setRules({ ...rules, require_working_hours: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between p-3 border rounded-xl bg-slate-50 dark:bg-slate-800 cursor-pointer">
                <div>
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 block">Allow Cross-Branch Fallback Dispatch</span>
                  <span className="text-[11px] text-slate-500">If no partner in assigned hub is available, dispatch to adjacent secondary hub partners.</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.allow_cross_branch_fallback}
                  onChange={(e) => setRules({ ...rules, allow_cross_branch_fallback: e.target.checked })}
                  className="w-5 h-5 accent-blue-600 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t">
              <Button variant="secondary" onClick={() => setShowRulesModal(false)}>Cancel</Button>
              <Button onClick={handleSaveRules} isLoading={savingRules} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                Save Assignment Rules
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
