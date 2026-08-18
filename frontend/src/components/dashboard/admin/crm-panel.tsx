"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Input, Button, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Search,
  Plus,
  UserPlus,
  RefreshCw,
  Phone,
  MessageSquare,
  Users,
  Download,
  Filter,
  UserCheck,
  AlertTriangle,
  Award,
  DollarSign,
  ShoppingCart,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Building2,
  Calendar,
} from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";
import { CustomerRecord, CustomerProfile, CrmAnalyticsSummary } from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";
import { CustomerProfileDrawer } from "./crm/customer-profile-drawer";
import { WhatsAppContactModal } from "./crm/whatsapp-contact-modal";
import { DuplicateMergeModal } from "./crm/duplicate-merge-modal";

export const CrmPanel = memo(function CrmPanel() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [summary, setSummary] = useState<CrmAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [activeSegment, setActiveSegment] = useState("all");
  const [lifecycleFilter, setLifecycleFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [whatsappFilter, setWhatsappFilter] = useState("all");

  // Drawers & Modals
  const [selectedCustomerUid, setSelectedCustomerUid] = useState<string | null>(null);
  const [whatsappCustomer, setWhatsappCustomer] = useState<CustomerRecord | CustomerProfile | null>(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create Customer Form State
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createBranch, setCreateBranch] = useState("res_01KXYMAHGFPRY1G9TZKEVGAGAT");
  const [createIsVip, setCreateIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (lifecycleFilter !== "all") params.lifecycle = lifecycleFilter;
      if (tierFilter !== "all") params.tier = tierFilter;
      if (branchFilter !== "all") params.branch_id = branchFilter;
      if (whatsappFilter === "true") params.whatsapp_eligible = "true";
      if (activeSegment !== "all") params.segment = activeSegment;

      const [cusRes, dupRes]: any = await Promise.all([
        apiClient.getAdminCrmCustomers(params),
        apiClient.getAdminCrmDuplicates().catch(() => ({ duplicates: [] })),
      ]);

      if (cusRes?.customers || cusRes?.data) {
        setCustomers(cusRes.customers || cusRes.data || []);
      }
      if (cusRes?.summary) {
        setSummary(cusRes.summary);
      }
      if (dupRes?.duplicates) {
        setDuplicateCount(dupRes.duplicates.length);
      }
    } catch (err: any) {
      console.error("[CRM Panel Error] Failed to fetch customers:", err);
      setError(err.message || "Failed to load customer records");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search, lifecycleFilter, tierFilter, branchFilter, whatsappFilter, activeSegment]);

  useEffect(() => {
    fetchCrmData();
  }, [fetchCrmData]);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (lifecycleFilter !== "all") params.append("lifecycle", lifecycleFilter);
    if (tierFilter !== "all") params.append("tier", tierFilter);
    if (activeSegment !== "all") params.append("segment", activeSegment);

    window.open(`/api/v1/admin/crm/customers/export?${params.toString()}`, "_blank");
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createPhone.trim()) return;
    setSubmitting(true);
    setSuccessMsg(null);

    try {
      const newCus = {
        name: createName,
        phone: createPhone,
        email: createEmail,
        is_vip: createIsVip,
        branch_id: createBranch,
      };

      await apiClient.createAdminCustomer(newCus);
      fetchCrmData();
      setSuccessMsg(`Successfully created customer record for "${createName}"!`);
      setCreateName("");
      setCreatePhone("");
      setCreateEmail("");
      setCreateIsVip(false);
      setTimeout(() => {
        setShowCreateModal(false);
        setSuccessMsg(null);
      }, 1200);
    } catch (err: any) {
      console.error("Create customer error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallCustomer = async (customer: CustomerRecord) => {
    try {
      await apiClient.recordAdminCallAction(customer.customer_uid, undefined, "CALL_INITIATED");
      if (typeof window !== "undefined") {
        window.location.href = `tel:${customer.phone.replace(/\s+/g, "")}`;
      }
    } catch (err) {
      console.error("Failed to initiate call:", err);
    }
  };

  const getLifecycleBadge = (stage?: string) => {
    switch (stage) {
      case "LOYAL":
        return <Badge color="purple">👑 Loyal (5+ Orders)</Badge>;
      case "REPEAT_BUYER":
        return <Badge color="green">🔁 Repeat Buyer</Badge>;
      case "ACTIVE":
        return <Badge color="blue">⚡ Active</Badge>;
      case "FIRST_PURCHASE":
        return <Badge color="blue">🛒 First Purchase</Badge>;
      case "NEW":
        return <Badge color="orange">🌱 New Account</Badge>;
      case "REGISTERED":
        return <Badge color="orange">📝 Registered</Badge>;
      case "AT_RISK":
        return <Badge color="red">⚠️ At Risk (45d+)</Badge>;
      case "DORMANT":
        return <Badge color="grey">💤 Dormant (90d+)</Badge>;
      default:
        return <Badge color="grey">{stage || "Customer"}</Badge>;
    }
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case "VIP_PLATINUM":
        return <Badge color="purple" className="font-bold">👑 Platinum</Badge>;
      case "GOLD":
        return <Badge color="orange" className="font-semibold">🥇 Gold</Badge>;
      case "SILVER":
        return <Badge color="blue">🥈 Silver</Badge>;
      default:
        return <Badge color="grey">Standard</Badge>;
    }
  };

  return (
    <WidgetErrorBoundary>
      <div className="flex flex-col gap-6 animate-fade-in">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Heading level="h2" className="text-2xl font-extrabold text-neutral-900 dark:text-white">
                Customer CRM & Identity Engine
              </Heading>
              <Badge color="red" className="text-xs font-mono">
                {customers.length} Loaded
              </Badge>
            </div>
            <Text className="text-neutral-500 text-xs mt-0.5">
              Canonical customer identities, multi-channel purchase history, journey funnels, and automated recovery.
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="small"
              variant="secondary"
              onClick={fetchCrmData}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>

            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowDuplicateModal(true)}
              className={`flex items-center gap-1.5 text-xs ${
                duplicateCount > 0
                  ? "bg-amber-50 text-amber-900 border-amber-300 font-semibold"
                  : ""
              }`}
            >
              <Users className="w-3.5 h-3.5 text-amber-600" />
              Deduplication {duplicateCount > 0 && `(${duplicateCount})`}
            </Button>

            <Button
              size="small"
              variant="secondary"
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>

            <Button
              size="small"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add Customer
            </Button>
          </div>
        </div>

        {/* Real Analytical KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div
            onClick={() => {
              setActiveSegment("all");
              setLifecycleFilter("all");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSegment === "all" && lifecycleFilter === "all"
                ? "border-rose-500 bg-rose-50/40 dark:bg-rose-950/20 ring-1 ring-rose-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block mb-0.5">
              Total Customers
            </span>
            <span className="text-xl font-extrabold text-neutral-900 dark:text-white">
              {summary?.total_customers ?? customers.length}
            </span>
            <span className="text-[10px] text-neutral-400 block mt-0.5">Canonical Profiles</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_new_no_order");
              setLifecycleFilter("all");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSegment === "seg_new_no_order"
                ? "border-amber-500 bg-amber-50/40 dark:bg-amber-950/20 ring-1 ring-amber-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-0.5">
              New — No Purchase
            </span>
            <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400">
              {summary?.new_customers_no_order ?? 0}
            </span>
            <span className="text-[10px] text-amber-700/70 block mt-0.5">Ready for Welcome 15%</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_repeat_buyers");
              setLifecycleFilter("all");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSegment === "seg_repeat_buyers"
                ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
              Repeat Buyers (2+)
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary?.repeat_customers ?? 0}
            </span>
            <span className="text-[10px] text-emerald-700/70 block mt-0.5">High Retention</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_high_value_vip");
              setLifecycleFilter("all");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSegment === "seg_high_value_vip"
                ? "border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 ring-1 ring-purple-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block mb-0.5">
              VIP Platinum
            </span>
            <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
              {summary?.high_value_customers ?? 0}
            </span>
            <span className="text-[10px] text-purple-700/70 block mt-0.5">₹5k+ Lifetime Value</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_at_risk");
              setLifecycleFilter("all");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              activeSegment === "seg_at_risk"
                ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-0.5">
              At Risk (45d+)
            </span>
            <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
              {summary?.at_risk_customers ?? 0}
            </span>
            <span className="text-[10px] text-red-700/70 block mt-0.5">Winback Eligible</span>
          </div>

          <div
            onClick={() => {
              setWhatsappFilter(whatsappFilter === "true" ? "all" : "true");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              whatsappFilter === "true"
                ? "border-green-500 bg-green-50/40 dark:bg-green-950/20 ring-1 ring-green-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider block mb-0.5">
              WhatsApp Reachable
            </span>
            <span className="text-xl font-extrabold text-green-600 dark:text-green-400">
              {summary?.whatsapp_contactable ?? 0}
            </span>
            <span className="text-[10px] text-green-700/70 block mt-0.5">Verified Consent</span>
          </div>
        </div>

        {/* Quick Segment Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {[
            { id: "all", label: "All Records" },
            { id: "seg_new_no_order", label: "🌱 New Registered — No Purchase" },
            { id: "seg_repeat_buyers", label: "🔁 Repeat Buyers" },
            { id: "seg_high_value_vip", label: "👑 VIP Platinum" },
            { id: "seg_at_risk", label: "⚠️ At Risk" },
            { id: "seg_dormant", label: "💤 Dormant" },
          ].map((seg) => (
            <button
              key={seg.id}
              onClick={() => setActiveSegment(seg.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeSegment === seg.id
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
              }`}
            >
              {seg.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 p-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Name, Phone, Email, UID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
          </div>

          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="py-1.5 px-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          >
            <option value="all">All Lifecycle Stages</option>
            <option value="NEW">New (No Orders)</option>
            <option value="FIRST_PURCHASE">First Purchase (1 Order)</option>
            <option value="REPEAT_BUYER">Repeat Buyer (2+ Orders)</option>
            <option value="LOYAL">Loyal VIP (5+ Orders)</option>
            <option value="AT_RISK">At Risk (45d+)</option>
            <option value="DORMANT">Dormant (90d+)</option>
          </select>

          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="py-1.5 px-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          >
            <option value="all">All Loyalty Tiers</option>
            <option value="VIP_PLATINUM">👑 VIP Platinum</option>
            <option value="GOLD">🥇 Gold</option>
            <option value="SILVER">🥈 Silver</option>
            <option value="STANDARD">Standard</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="py-1.5 px-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
          >
            <option value="all">All Kitchen Hubs</option>
            <option value="res_01KXYMAHGFPRY1G9TZKEVGAGAT">Indiranagar Flagship Kitchen</option>
            <option value="res_02KXYMAHGFPRY1G9TZKEVGAGAT">Koramangala Gourmet Bakery</option>
            <option value="res_03KXYMAHGFPRY1G9TZKEVGAGAT">Whitefield Gourmet Studio</option>
          </select>
        </div>

        {/* Master Customer Table */}
        <Container className="p-0 overflow-hidden border border-neutral-200 dark:border-neutral-800 rounded-xl shadow-xs">
          {loading ? (
            <TableSkeleton rows={6} />
          ) : customers.length === 0 ? (
            <div className="p-16 text-center flex flex-col items-center gap-2">
              <Users className="w-10 h-10 text-neutral-400" />
              <Heading level="h3" className="text-sm font-bold text-neutral-900 dark:text-white">
                No Customer Records Found
              </Heading>
              <Text className="text-xs text-neutral-500 max-w-sm">
                No customers matched your filter criteria. Try clearing search keywords or segment filters.
              </Text>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/80 text-neutral-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Phone & WhatsApp</th>
                    <th className="py-3 px-4">Lifecycle Stage</th>
                    <th className="py-3 px-4">Tier</th>
                    <th className="py-3 px-4 text-right">Orders / Spend</th>
                    <th className="py-3 px-4">Assigned Branch</th>
                    <th className="py-3 px-4">Last Active</th>
                    <th className="py-3 px-4 text-center">Quick Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {customers.map((c) => (
                    <tr
                      key={c.customer_uid || c.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCustomerUid(c.customer_uid || c.id)}
                    >
                      {/* Customer Name & Info */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-bold flex items-center justify-center text-xs shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-neutral-900 dark:text-white truncate">
                              {c.name}
                            </span>
                            <span className="font-mono text-[10px] text-neutral-400 truncate">
                              {c.customer_number || c.customer_uid}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Phone & WhatsApp */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex flex-col gap-1">
                          <span className="font-mono font-medium text-neutral-900 dark:text-white">
                            {formatDisplayPhone(c.phone)}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {c.consent?.whatsapp_status === "ELIGIBLE" ? (
                              <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                <ShieldCheck className="w-3 h-3" /> WhatsApp OK
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-400">Opted Out</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Lifecycle */}
                      <td className="py-3 px-4">{getLifecycleBadge(c.lifecycle_stage)}</td>

                      {/* Tier */}
                      <td className="py-3 px-4">{getTierBadge(c.tier)}</td>

                      {/* Orders & Spend */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span className="font-extrabold text-neutral-900 dark:text-white">
                            ₹{(c.total_spend || 0).toLocaleString("en-IN")}
                          </span>
                          <span className="text-[10px] text-neutral-500">
                            {c.orders_count || 0} {c.orders_count === 1 ? "order" : "orders"}
                          </span>
                        </div>
                      </td>

                      {/* Branch */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-neutral-700 dark:text-neutral-300 font-medium">
                          {c.branch_name || "Indiranagar Hub"}
                        </span>
                      </td>

                      {/* Last Active */}
                      <td className="py-3 px-4 text-neutral-500 text-[11px]">
                        {new Date(c.last_active_at || c.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            title="Call Customer"
                            onClick={() => handleCallCustomer(c)}
                            className="p-1.5 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-950 text-emerald-700 dark:text-emerald-400 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>

                          <button
                            title="WhatsApp Message"
                            onClick={() => setWhatsappCustomer(c)}
                            className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-950 text-green-800 dark:text-green-300 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>

                          <button
                            title="View Profile Drawer"
                            onClick={() => setSelectedCustomerUid(c.customer_uid || c.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950 text-rose-700 dark:text-rose-400 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Container>

        {/* Profile Drawer */}
        <CustomerProfileDrawer
          customerUid={selectedCustomerUid}
          isOpen={Boolean(selectedCustomerUid)}
          onClose={() => setSelectedCustomerUid(null)}
          onOpenWhatsAppModal={(prof) => setWhatsappCustomer(prof)}
          onRefreshList={fetchCrmData}
        />

        {/* WhatsApp Modal */}
        <WhatsAppContactModal
          customer={whatsappCustomer}
          isOpen={Boolean(whatsappCustomer)}
          onClose={() => setWhatsappCustomer(null)}
          onSuccess={fetchCrmData}
        />

        {/* Duplicate Merge Modal */}
        <DuplicateMergeModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          onMergedSuccess={fetchCrmData}
        />

        {/* Create Customer Record Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-rose-50/40 dark:bg-rose-950/20">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-rose-600" />
                  <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                    Add Customer Record
                  </Heading>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-8 h-8 rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-800 flex items-center justify-center text-neutral-500"
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleCreateCustomer} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Customer Full Name *</Label>
                  <Input
                    required
                    placeholder="e.g. Vikram Sharma"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Mobile Phone (+91) *</Label>
                  <Input
                    required
                    placeholder="+91 98765 43210"
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Email Address (Optional)</Label>
                  <Input
                    type="email"
                    placeholder="vikram@example.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <Label className="text-xs font-bold text-neutral-700 dark:text-neutral-300">Assigned Branch Kitchen</Label>
                  <select
                    value={createBranch}
                    onChange={(e) => setCreateBranch(e.target.value)}
                    className="p-2 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800"
                  >
                    <option value="res_01KXYMAHGFPRY1G9TZKEVGAGAT">Indiranagar Flagship Kitchen</option>
                    <option value="res_02KXYMAHGFPRY1G9TZKEVGAGAT">Koramangala Gourmet Bakery</option>
                    <option value="res_03KXYMAHGFPRY1G9TZKEVGAGAT">Whitefield Gourmet Studio</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 text-xs cursor-pointer text-neutral-700 dark:text-neutral-300">
                  <input
                    type="checkbox"
                    checked={createIsVip}
                    onChange={(e) => setCreateIsVip(e.target.checked)}
                    className="rounded text-rose-600 focus:ring-rose-500"
                  />
                  <span>Designate as VIP Platinum Customer (Priority Delivery)</span>
                </label>

                {successMsg && (
                  <div className="p-3 bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-lg">
                    {successMsg}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-neutral-800">
                  <Button variant="secondary" size="small" type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button size="small" type="submit" isLoading={submitting} className="bg-rose-600 hover:bg-rose-700 text-white">
                    Save Customer Profile
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </WidgetErrorBoundary>
  );
});
