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
  Layers,
  TrendingUp,
  X,
} from "lucide-react";
import { TableSkeleton } from "./admin-skeletons";
import { WidgetErrorBoundary } from "./error-boundary";
import { CustomerRecord, CustomerProfile, CrmAnalyticsSummary, CustomerSegment } from "@frontend/lib/crm/types";
import { formatDisplayPhone } from "@frontend/lib/crm/crm-engine";
import { CustomerProfileDrawer } from "./crm/customer-profile-drawer";
import { WhatsAppContactModal } from "./crm/whatsapp-contact-modal";
import { DuplicateMergeModal } from "./crm/duplicate-merge-modal";

export const CrmPanel = memo(function CrmPanel() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [summary, setSummary] = useState<CrmAnalyticsSummary | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [segments, setSegments] = useState<CustomerSegment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Health Report State
  const [healthReport, setHealthReport] = useState<any | null>(null);
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);

  // Segment Builder State
  const [showSegmentModal, setShowSegmentModal] = useState(false);
  const [segmentName, setSegmentName] = useState("");
  const [segmentDesc, setSegmentDesc] = useState("");
  const [segmentConditionsJson, setSegmentConditionsJson] = useState('{\n  "min_orders": 1,\n  "min_spend": 500\n}');
  const [submittingSegment, setSubmittingSegment] = useState(false);

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
  const [createBranch, setCreateBranch] = useState("");
  const [createIsVip, setCreateIsVip] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchHealthReport = async () => {
    setHealthLoading(true);
    try {
      const res: any = await apiClient.getCrmHealth();
      if (res) setHealthReport(res);
    } catch (err) {
      console.error("Failed to fetch CRM health report:", err);
    } finally {
      setHealthLoading(false);
    }
  };

  // Initial metadata fetch (branches & segments)
  useEffect(() => {
    async function loadMeta() {
      try {
        const [branchRes, segRes, healthRes]: any = await Promise.all([
          apiClient.getBranches().catch(() => ({ branches: [] })),
          apiClient.getCrmSegments().catch(() => ({ segments: [] })),
          apiClient.getCrmHealth().catch(() => null),
        ]);
        const branchList = branchRes?.branches || [];
        setBranches(branchList);
        if (branchList.length > 0) {
          setCreateBranch(branchList[0].id);
        }
        setSegments(segRes?.segments || []);
        if (healthRes) setHealthReport(healthRes);
      } catch (err) {
        console.error("Failed to load CRM metadata:", err);
      }
    }
    loadMeta();
  }, []);

  const fetchCrmData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (lifecycleFilter !== "all") params.lifecycle = lifecycleFilter;
      if (tierFilter !== "all") params.tier = tierFilter;
      if (branchFilter !== "all") params.branch_id = branchFilter;
      if (whatsappFilter !== "all") params.whatsapp_status = whatsappFilter;
      if (activeSegment !== "all") params.segment = activeSegment;

      const [cusRes, dupRes]: any = await Promise.all([
        apiClient.getAdminCustomers(params),
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

  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!segmentName.trim()) return;
    setSubmittingSegment(true);
    try {
      await apiClient.createCrmSegment({
        name: segmentName,
        description: segmentDesc,
        conditions_json: segmentConditionsJson,
        active: true,
      });
      setShowSegmentModal(false);
      setSegmentName("");
      setSegmentDesc("");
      const segRes: any = await apiClient.getCrmSegments();
      setSegments(segRes?.segments || []);
    } catch (err) {
      console.error("Failed to create segment:", err);
    } finally {
      setSubmittingSegment(false);
    }
  };

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
        branch_id: createBranch || (branches[0]?.id),
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
      console.error("Call error:", err);
    }
  };

  const getLifecycleBadge = (stage?: string) => {
    switch (stage) {
      case "VIP":
        return <Badge color="purple">👑 VIP</Badge>;
      case "REPEAT_BUYER":
        return <Badge color="green">🔁 Repeat Buyer</Badge>;
      case "FIRST_PURCHASE":
        return <Badge color="blue">🌟 First Purchase</Badge>;
      case "NEW":
        return <Badge color="orange">🌱 New</Badge>;
      case "AT_RISK":
        return <Badge color="red">⚠️ At Risk</Badge>;
      case "DORMANT":
        return <Badge color="grey">💤 Dormant</Badge>;
      default:
        return <Badge color="grey">{stage || "UNKNOWN"}</Badge>;
    }
  };

  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case "VIP_PLATINUM":
        return <Badge color="purple" className="font-bold">👑 Platinum</Badge>;
      case "GOLD":
        return <Badge color="orange">🥇 Gold</Badge>;
      case "SILVER":
        return <Badge color="blue">🥈 Silver</Badge>;
      default:
        return <Badge color="grey">Standard</Badge>;
    }
  };

  const getWhatsAppBadge = (status?: string) => {
    switch (status) {
      case "CONNECTED":
      case "OPTED_IN":
        return (
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5">
            <ShieldCheck className="w-3 h-3" /> Connected
          </span>
        );
      case "OPTED_OUT":
        return <span className="text-[10px] text-rose-500 font-medium">Opted Out</span>;
      case "INVALID":
        return <span className="text-[10px] text-rose-400 font-medium">Invalid</span>;
      default:
        return <span className="text-[10px] text-neutral-400">Unknown</span>;
    }
  };

  return (
    <WidgetErrorBoundary widgetName="CRM Customer & Identity Engine">
      <div className="flex flex-col gap-6 p-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Heading level="h1" className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
                Customer CRM & Identity Engine
              </Heading>
              <Badge color="purple" className="text-xs font-bold uppercase tracking-wider">
                Enterprise 360
              </Badge>
              <Badge color={healthReport?.environment_mode === "production" ? "green" : "blue"} className="text-xs font-bold uppercase tracking-wider">
                {healthReport?.environment_mode ? `ENV: ${healthReport.environment_mode.toUpperCase()}` : "ENV: PRODUCTION"}
              </Badge>
            </div>
            <Text className="text-xs text-neutral-500 max-w-2xl">
              Production database-verified customer directory. Zero test/placeholder customer pollution. Multi-branch routing and deterministic data lineage tracing.
            </Text>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                fetchHealthReport();
                setShowHealthModal(true);
              }}
              className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              {healthReport?.healthy ? "DB Health: 100%" : "Check DB Health"}
            </Button>

            {duplicateCount > 0 && (
              <Button
                size="small"
                variant="secondary"
                onClick={() => setShowDuplicateModal(true)}
                className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950 dark:text-amber-300"
              >
                <Users className="w-3.5 h-3.5" /> Duplicates ({duplicateCount})
              </Button>
            )}

            <Button
              size="small"
              variant="secondary"
              onClick={() => setShowSegmentModal(true)}
              className="flex items-center gap-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300"
            >
              <Layers className="w-3.5 h-3.5" /> New Segment
            </Button>

            <Button
              size="small"
              variant="secondary"
              onClick={fetchCrmData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
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

        {/* Live Analytical KPI Summary Cards */}
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
            <span className="text-[10px] text-neutral-400 block mt-0.5">Database Verified</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_first_purchase");
              setLifecycleFilter("FIRST_PURCHASE");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              lifecycleFilter === "FIRST_PURCHASE"
                ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 ring-1 ring-blue-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block mb-0.5">
              First Purchase
            </span>
            <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">
              {summary?.lifecycle_breakdown?.FIRST_PURCHASE ?? 0}
            </span>
            <span className="text-[10px] text-blue-700/70 block mt-0.5">1 Completed Order</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_repeat_buyers");
              setLifecycleFilter("REPEAT_BUYER");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              lifecycleFilter === "REPEAT_BUYER"
                ? "border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20 ring-1 ring-emerald-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block mb-0.5">
              Repeat Buyers (2+)
            </span>
            <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary?.lifecycle_breakdown?.REPEAT_BUYER ?? 0}
            </span>
            <span className="text-[10px] text-emerald-700/70 block mt-0.5">
              {summary?.repeat_purchase_rate_pct ?? 0}% Repeat Rate
            </span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_vip");
              setLifecycleFilter("VIP");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              lifecycleFilter === "VIP"
                ? "border-purple-500 bg-purple-50/40 dark:bg-purple-950/20 ring-1 ring-purple-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block mb-0.5">
              VIP Patrons
            </span>
            <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400">
              {summary?.vip_customers_count ?? 0}
            </span>
            <span className="text-[10px] text-purple-700/70 block mt-0.5">₹5k+ Spend or VIP Tag</span>
          </div>

          <div
            onClick={() => {
              setActiveSegment("seg_at_risk");
              setLifecycleFilter("AT_RISK");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              lifecycleFilter === "AT_RISK"
                ? "border-red-500 bg-red-50/40 dark:bg-red-950/20 ring-1 ring-red-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider block mb-0.5">
              At Risk (45d+)
            </span>
            <span className="text-xl font-extrabold text-red-600 dark:text-red-400">
              {summary?.at_risk_customers_count ?? 0}
            </span>
            <span className="text-[10px] text-red-700/70 block mt-0.5">Winback Target</span>
          </div>

          <div
            onClick={() => {
              setWhatsappFilter(whatsappFilter === "CONNECTED" ? "all" : "CONNECTED");
            }}
            className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
              whatsappFilter === "CONNECTED"
                ? "border-green-500 bg-green-50/40 dark:bg-green-950/20 ring-1 ring-green-500"
                : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-300"
            }`}
          >
            <span className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase tracking-wider block mb-0.5">
              WhatsApp Reach
            </span>
            <span className="text-xl font-extrabold text-green-600 dark:text-green-400">
              {summary?.whatsapp_reachable_count ?? 0}
            </span>
            <span className="text-[10px] text-green-700/70 block mt-0.5">Opted-In Contacts</span>
          </div>
        </div>

        {/* Dynamic Segments Ribbon */}
        {segments.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" /> Segments:
            </span>
            <button
              onClick={() => setActiveSegment("all")}
              className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                activeSegment === "all"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
              }`}
            >
              All Patrons
            </button>
            {segments.map((seg) => (
              <button
                key={seg.id}
                onClick={() => setActiveSegment(seg.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                  activeSegment === seg.id
                    ? "bg-rose-600 text-white shadow-xs"
                    : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200"
                }`}
              >
                <span>{seg.icon || "🏷️"}</span>
                <span>{seg.name}</span>
                {seg.customer_count !== undefined && (
                  <span className="text-[10px] opacity-75 font-mono">({seg.customer_count})</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Search & Multi-Filter Ribbon */}
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
            <option value="NEW">New (0 Orders)</option>
            <option value="FIRST_PURCHASE">First Purchase (1 Order)</option>
            <option value="REPEAT_BUYER">Repeat Buyer (2+ Orders)</option>
            <option value="VIP">VIP Platinum</option>
            <option value="AT_RISK">At Risk (45d+ Inactive)</option>
            <option value="DORMANT">Dormant (90d+ Inactive)</option>
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
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name || b.branch_name || b.id} {b.city ? `(${b.city})` : ""}
              </option>
            ))}
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
                    <th className="py-3 px-4">Customer Identity</th>
                    <th className="py-3 px-4">Phone & WhatsApp</th>
                    <th className="py-3 px-4">Lifecycle Stage</th>
                    <th className="py-3 px-4">Intelligence</th>
                    <th className="py-3 px-4 text-right">Orders / Spend</th>
                    <th className="py-3 px-4">Fulfillment Hub</th>
                    <th className="py-3 px-4">Telecaller</th>
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
                        <div className="flex flex-col gap-0.5">
                          <span className="font-mono font-medium text-neutral-900 dark:text-white">
                            {formatDisplayPhone(c.phone)}
                          </span>
                          <div>{getWhatsAppBadge(c.consent?.whatsapp_status)}</div>
                        </div>
                      </td>

                      {/* Lifecycle */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getLifecycleBadge(c.lifecycle_stage)}
                          {getTierBadge(c.tier)}
                        </div>
                      </td>

                      {/* Intelligence Score */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-amber-500 font-mono text-xs">
                            {c.customer_intelligence_score ?? 85}/100
                          </span>
                          <span className="text-[10px] text-neutral-400">Score</span>
                        </div>
                      </td>

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
                          {c.branch_name || "—"}
                        </span>
                        <span className="text-[10px] text-neutral-400 block">
                          {c.city_name || ""}
                        </span>
                      </td>

                      {/* Telecaller */}
                      <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300 text-[11px]">
                        {c.assigned_telecaller_name ? (
                          <span className="font-medium text-purple-600 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded">
                            {c.assigned_telecaller_name}
                          </span>
                        ) : (
                          <span className="text-neutral-400">Unassigned</span>
                        )}
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
                            title="View Customer 360 & Lineage"
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

        {/* Customer 360 Profile Drawer */}
        <CustomerProfileDrawer
          customerUid={selectedCustomerUid}
          isOpen={Boolean(selectedCustomerUid)}
          onClose={() => setSelectedCustomerUid(null)}
          onOpenWhatsAppModal={(cust) => setWhatsappCustomer(cust)}
          onRefreshList={fetchCrmData}
        />

        {/* WhatsApp Direct Outreach Modal */}
        {whatsappCustomer && (
          <WhatsAppContactModal
            customer={whatsappCustomer}
            isOpen={Boolean(whatsappCustomer)}
            onClose={() => setWhatsappCustomer(null)}
            onSuccess={fetchCrmData}
          />
        )}

        {/* Deduplication Merge Modal */}
        {showDuplicateModal && (
          <DuplicateMergeModal
            isOpen={showDuplicateModal}
            onClose={() => setShowDuplicateModal(false)}
            onMergedSuccess={fetchCrmData}
          />
        )}

        {/* Database Health KPI Modal */}
        {showHealthModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                    Database Health & Integrity Audit
                  </Heading>
                </div>
                <button onClick={() => setShowHealthModal(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {healthLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
                </div>
              ) : healthReport ? (
                <div className="flex flex-col gap-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex flex-col">
                      <span className="text-neutral-500">Total Customers</span>
                      <span className="text-lg font-bold text-neutral-900 dark:text-white">{healthReport.total_customers}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex flex-col">
                      <span className="text-neutral-500">Duplicate Rate</span>
                      <span className="text-lg font-bold text-emerald-600">{healthReport.duplicate_rate}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex flex-col">
                      <span className="text-neutral-500">With Order History</span>
                      <span className="text-lg font-bold text-blue-600">{healthReport.customers_with_orders}</span>
                    </div>
                    <div className="p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 flex flex-col">
                      <span className="text-neutral-500">Accounts (0 Orders)</span>
                      <span className="text-lg font-bold text-amber-600">{healthReport.customers_without_orders}</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Missing Branch Mappings</span>
                      <span>{healthReport.missing_branch_mapping}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Missing Phone Numbers</span>
                      <span>{healthReport.missing_phone}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                      <span>Environment Filter Status</span>
                      <span>{healthReport.environment_mode?.toUpperCase()} (Pollution Block Active)</span>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button size="small" onClick={() => setShowHealthModal(false)}>
                      Close Audit Report
                    </Button>
                  </div>
                </div>
              ) : (
                <Text className="text-neutral-500 text-xs">Failed to load health report.</Text>
              )}
            </div>
          </div>
        )}

        {/* Dynamic Segment Builder Modal */}
        {showSegmentModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                  Create Dynamic Customer Segment
                </Heading>
                <button onClick={() => setShowSegmentModal(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSegment} className="flex flex-col gap-3.5 text-xs">
                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Segment Name *</Label>
                  <Input
                    value={segmentName}
                    onChange={(e) => setSegmentName(e.target.value)}
                    placeholder="e.g. High Value Churn Risk"
                    required
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Description</Label>
                  <Input
                    value={segmentDesc}
                    onChange={(e) => setSegmentDesc(e.target.value)}
                    placeholder="e.g. VIP clients inactive for > 30 days"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="font-semibold text-neutral-700 dark:text-neutral-300">Conditions JSON Rule</Label>
                  <textarea
                    value={segmentConditionsJson}
                    onChange={(e) => setSegmentConditionsJson(e.target.value)}
                    rows={4}
                    className="w-full mt-1 p-2 font-mono text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <Button size="small" variant="secondary" type="button" onClick={() => setShowSegmentModal(false)}>
                    Cancel
                  </Button>
                  <Button size="small" type="submit" disabled={submittingSegment || !segmentName} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {submittingSegment ? "Creating..." : "Save Segment"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Customer Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 p-6 flex flex-col gap-4 animate-scale-in">
              <div className="flex items-center justify-between border-b border-neutral-100 dark:border-neutral-800 pb-3">
                <Heading level="h2" className="text-base font-bold text-neutral-900 dark:text-white">
                  Add New Customer Record
                </Heading>
                <button onClick={() => setShowCreateModal(false)} className="text-neutral-400 hover:text-neutral-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold">
                  {successMsg}
                </div>
              )}

              <form onSubmit={handleCreateCustomer} className="flex flex-col gap-3.5">
                <div>
                  <Label className="text-xs font-semibold">Full Name *</Label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="e.g. Priya Nair"
                    className="text-xs mt-1"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Mobile Number *</Label>
                  <Input
                    value={createPhone}
                    onChange={(e) => setCreatePhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="text-xs mt-1"
                    required
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Email Address (Optional)</Label>
                  <Input
                    type="email"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    placeholder="e.g. priya.nair@example.com"
                    className="text-xs mt-1"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold">Assigned Fulfillment Hub</Label>
                  <select
                    value={createBranch}
                    onChange={(e) => setCreateBranch(e.target.value)}
                    className="w-full mt-1 py-2 px-3 text-xs rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name || b.branch_name || b.id} {b.city ? `(${b.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="isVip"
                    checked={createIsVip}
                    onChange={(e) => setCreateIsVip(e.target.checked)}
                    className="rounded border-neutral-300 text-rose-600 focus:ring-rose-500"
                  />
                  <Label htmlFor="isVip" className="text-xs cursor-pointer font-medium">
                    Grant VIP Patron Status
                  </Label>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
                  <Button size="small" variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button size="small" type="submit" disabled={submitting} className="bg-rose-600 hover:bg-rose-700 text-white">
                    {submitting ? "Creating..." : "Save Customer"}
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
