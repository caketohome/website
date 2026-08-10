"use client";

import { useEffect, useState, memo } from "react";
import {
  Tag,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Copy,
  Check,
  TrendingUp,
  Percent,
  IndianRupee,
  Calendar,
  Layers,
  MapPin,
  Building,
  Users,
  ShieldCheck,
  Clock,
  Sparkles,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  AlertCircle,
  FileSpreadsheet,
} from "lucide-react";
import { CouponDrawer } from "./coupon-drawer";

export const MarketingPanel = memo(function MarketingPanel() {
  const [offers, setOffers] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [redemptionsFeed, setRedemptionsFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<"master" | "analytics" | "feed" | "import">("master");

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [cityFilter, setCityFilter] = useState("all");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);

  // Selection & Bulk
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Import modal state
  const [importCsvText, setImportCsvText] = useState("");
  const [importing, setImporting] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchMarketingData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (branchFilter !== "all") params.set("branch_id", branchFilter);
      if (cityFilter !== "all") params.set("city", cityFilter);
      if (searchQuery) params.set("q", searchQuery);

      const [offersRes, analyticsRes, reportsRes, feedRes] = await Promise.all([
        fetch(`/api/v1/admin/offers?${params.toString()}`).then((r) => r.json()).catch(() => ({ offers: [] })),
        fetch("/api/v1/admin/offers/analytics").then((r) => r.json()).catch(() => ({ analytics: null })),
        fetch("/api/v1/admin/offers/reports?group_by=branch").then((r) => r.json()).catch(() => ({ reports: [] })),
        fetch("/api/v1/admin/offers/reports?group_by=feed").then((r) => r.json()).catch(() => ({ reports: [] })),
      ]);

      setOffers(offersRes.offers || []);
      setAnalytics(analyticsRes.analytics || null);
      setReports(reportsRes.reports || []);
      setRedemptionsFeed(feedRes.reports || feedRes.redemptions || []);
    } catch (err: any) {
      showToast(err.message || "Failed to load marketing data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketingData();
  }, [statusFilter, typeFilter, branchFilter, cityFilter]);

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    showToast(`Copied code "${code}" to clipboard!`);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleToggleStatus = async (offer: any) => {
    const newStatus = offer.status === "active" ? "paused" : "active";
    try {
      await fetch(`/api/v1/admin/offers/${offer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      showToast(`Coupon "${offer.code}" marked as ${newStatus}.`);
      fetchMarketingData();
    } catch {
      showToast("Failed to update status.");
    }
  };

  const handleCloneCoupon = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/admin/offers/${id}/clone`, { method: "POST" });
      const data = await res.json();
      showToast(`Cloned into draft coupon "${data.offer?.code}"!`);
      fetchMarketingData();
    } catch {
      showToast("Failed to clone coupon.");
    }
  };

  const handleDeleteOffer = async (id: string, code: string) => {
    if (!confirm(`Are you sure you want to delete coupon "${code}"?`)) return;
    try {
      await fetch(`/api/v1/admin/offers/${id}`, { method: "DELETE" });
      showToast(`Deleted coupon "${code}".`);
      fetchMarketingData();
    } catch {
      showToast("Failed to delete coupon.");
    }
  };

  const handleBulkAction = async (action: "active" | "paused" | "delete") => {
    if (selectedIds.length === 0) return;
    if (action === "delete") {
      if (!confirm(`Delete ${selectedIds.length} selected coupons?`)) return;
      for (const id of selectedIds) {
        await fetch(`/api/v1/admin/offers/${id}`, { method: "DELETE" });
      }
      showToast(`Deleted ${selectedIds.length} coupons.`);
    } else {
      for (const id of selectedIds) {
        await fetch(`/api/v1/admin/offers/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: action }),
        });
      }
      showToast(`Updated ${selectedIds.length} coupons to ${action}.`);
    }
    setSelectedIds([]);
    fetchMarketingData();
  };

  const handleExport = (format: "csv" | "json") => {
    window.open(`/api/v1/admin/offers/export?format=${format}&type=coupons`, "_blank");
  };

  const handleImportSubmit = async () => {
    if (!importCsvText.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/v1/admin/offers/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_data: importCsvText }),
      });
      const data = await res.json();
      showToast(`Successfully imported ${data.imported_count || 0} coupons!`);
      setImportCsvText("");
      setActiveSubTab("master");
      fetchMarketingData();
    } catch {
      showToast("Failed to import coupons.");
    } finally {
      setImporting(false);
    }
  };

  const filteredOffers = offers.filter((o) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const match =
        (o.name && o.name.toLowerCase().includes(q)) ||
        (o.code && o.code.toLowerCase().includes(q)) ||
        (o.description && o.description.toLowerCase().includes(q));
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6 p-1">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-5 right-5 z-50 p-3 bg-pink-600 text-white rounded-xl shadow-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Tag className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Marketing & Coupon Engine</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live Engine
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Shopify Plus-grade promotional architecture: 16+ coupon types, multi-tier geographic & customer restrictions, usage caps, and real-time checkout validation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport("csv")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors shadow-sm"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
          <button
            onClick={() => setActiveSubTab("import")}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold rounded-lg border border-slate-800 transition-colors shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" /> Bulk Import
          </button>
          <button
            onClick={() => {
              setSelectedCouponId(null);
              setDrawerOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-pink-500/25 transition-all"
          >
            <Plus className="w-4 h-4" /> Create Coupon
          </button>
        </div>
      </div>

      {/* KPI Summary Cards - 100% Real Persisted Order & Redemption Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Total Promos</div>
          <div className="text-lg font-bold text-white mt-1">
            {analytics?.total_coupons ?? offers.length}
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            {analytics?.active_coupons ?? offers.filter((o) => o.status === "active").length} Active
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Gross Sales Generated</div>
          <div className="text-lg font-bold text-emerald-400 mt-1">
            ₹{(analytics?.total_revenue_generated ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Driven by coupons</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Discounts Given</div>
          <div className="text-lg font-bold text-rose-400 mt-1">
            ₹{(analytics?.total_discount_given ?? 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Cost of promotions</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Total Redemptions</div>
          <div className="text-lg font-bold text-white mt-1">
            {analytics?.total_redemptions ?? 0}
          </div>
          <div className="text-[10px] text-cyan-400 mt-0.5">
            {analytics?.uses_today ?? 0} today
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Average Discount</div>
          <div className="text-lg font-bold text-amber-400 mt-1">
            ₹{analytics?.average_discount ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">Per order</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Average Order Value</div>
          <div className="text-lg font-bold text-indigo-400 mt-1">
            ₹{analytics?.average_order_value ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">With coupon applied</div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="text-[11px] font-medium text-slate-400">Marketing ROI</div>
          <div className="text-lg font-bold text-cyan-400 mt-1">
            {analytics?.roi_percentage ?? 0}%
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">
            {(analytics?.roi_percentage ?? 0) > 0 ? "High efficiency" : "Awaiting orders"}
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-950/40 px-2">
        {[
          { id: "master", label: "Coupons Master", icon: Tag },
          { id: "analytics", label: "Live Performance & Branch ROI", icon: TrendingUp },
          { id: "feed", label: "Customer Redemption Feed", icon: Users },
          { id: "import", label: "CSV Import & Migration", icon: FileSpreadsheet },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                isActive
                  ? "border-pink-500 text-pink-400 bg-pink-500/5"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: COUPONS MASTER */}
      {activeSubTab === "master" && (
        <div className="space-y-4">
          {/* Multi-Dimensional Filter Toolbar */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search name, code, terms..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-pink-500"
              />
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="scheduled">Scheduled</option>
                <option value="draft">Draft / Testing</option>
                <option value="paused">Paused</option>
                <option value="expired">Expired</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="all">All Types</option>
                <option value="percentage">Percentage (%)</option>
                <option value="flat">Fixed Amount (₹)</option>
                <option value="free_delivery">Free Delivery</option>
                <option value="free_addon">Free Add-on</option>
                <option value="buy_x_get_y">BOGO</option>
                <option value="first_order">First Order</option>
                <option value="birthday_coupon">Birthday</option>
              </select>
            </div>

            <div>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="all">All Branches</option>
                <option value="br_kollam_01">Kollam Central</option>
                <option value="br_kottiyam_02">Kottiyam Express</option>
                <option value="br_kochi_01">Kochi Marine Drive</option>
                <option value="br_trivandrum_01">Trivandrum City</option>
              </select>
            </div>

            <div>
              <select
                value={cityFilter}
                onChange={(e) => setCityFilter(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
              >
                <option value="all">All Cities</option>
                <option value="Kollam">Kollam</option>
                <option value="Kochi">Kochi</option>
                <option value="Trivandrum">Trivandrum</option>
                <option value="Bangalore">Bangalore</option>
              </select>
            </div>
          </div>

          {/* Bulk Selection Bar */}
          {selectedIds.length > 0 && (
            <div className="p-3 bg-pink-500/10 border border-pink-500/30 rounded-xl flex items-center justify-between animate-in fade-in">
              <span className="text-xs font-semibold text-pink-300">
                {selectedIds.length} coupons selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkAction("active")}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg"
                >
                  Bulk Activate
                </button>
                <button
                  onClick={() => handleBulkAction("paused")}
                  className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg"
                >
                  Bulk Pause
                </button>
                <button
                  onClick={() => handleBulkAction("delete")}
                  className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg"
                >
                  Bulk Delete
                </button>
              </div>
            </div>
          )}

          {/* Coupons Data Table */}
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                  <tr>
                    <th className="p-3 w-8">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === filteredOffers.length && filteredOffers.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(filteredOffers.map((o) => o.id));
                          else setSelectedIds([]);
                        }}
                        className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-pink-500"
                      />
                    </th>
                    <th className="p-3">Coupon Code & Name</th>
                    <th className="p-3">Promotion Type</th>
                    <th className="p-3">Discount Details</th>
                    <th className="p-3">Targeting & Rules</th>
                    <th className="p-3">Usage Progress</th>
                    <th className="p-3 text-right">Revenue Driven</th>
                    <th className="p-3 text-center">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-pink-400" />
                          <span>Loading active coupons & promotions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredOffers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-400">
                        <Tag className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <div className="text-sm font-semibold text-slate-300">No matching coupons found</div>
                        <p className="text-xs text-slate-500 mt-1">Try changing your filters or create a new coupon.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredOffers.map((o) => {
                      const isSelected = selectedIds.includes(o.id);
                      const discountText =
                        o.type === "percentage"
                          ? `${o.metadata?.discount_value || o.discount_value || 10}% OFF`
                          : o.type === "free_delivery"
                          ? "FREE DELIVERY"
                          : o.type === "free_addon"
                          ? "FREE ACCESSORY"
                          : `₹${o.metadata?.discount_value || o.discount_value || 50} FLAT`;

                      const redCount = Number(o.total_redemptions) || 0;
                      const limitCount = o.usage_limit ? Number(o.usage_limit) : null;
                      const usagePercent = limitCount ? Math.min(100, Math.round((redCount / limitCount) * 100)) : null;

                      return (
                        <tr key={o.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                if (e.target.checked) setSelectedIds([...selectedIds, o.id]);
                                else setSelectedIds(selectedIds.filter((x) => x !== o.id));
                              }}
                              className="w-3.5 h-3.5 rounded bg-slate-900 border-slate-700 text-pink-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCopyCode(o.code)}
                                className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-pink-400 font-mono font-bold text-xs flex items-center gap-1 hover:border-pink-500/50"
                                title="Click to copy coupon code"
                              >
                                {o.code}
                                {copiedCode === o.code ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                              <div className="font-semibold text-white truncate max-w-[180px]">{o.name}</div>
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[260px] mt-0.5">
                              {o.description || "No description"}
                            </div>
                          </td>

                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 uppercase">
                              {o.type.replace(/_/g, " ")}
                            </span>
                          </td>

                          <td className="p-3">
                            <div className="font-bold text-white">{discountText}</div>
                            {o.max_discount_value && (
                              <div className="text-[10px] text-slate-400">Cap: ₹{o.max_discount_value}</div>
                            )}
                            {o.min_order_value > 0 && (
                              <div className="text-[10px] text-slate-400">Min Cart: ₹{o.min_order_value}</div>
                            )}
                          </td>

                          <td className="p-3">
                            <div className="text-[11px] text-slate-300">
                              {o.applicable_branches && !o.applicable_branches.includes("all")
                                ? `${Array.isArray(o.applicable_branches) ? o.applicable_branches.length : 1} Branches`
                                : "All Branches"}
                              {" • "}
                              {o.customer_eligibility === "vip"
                                ? "VIP Members"
                                : o.customer_eligibility === "new_customers"
                                ? "New Users"
                                : "Everyone"}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {o.never_expires ? "Never Expires" : o.ends_at ? `Exp: ${new Date(o.ends_at).toLocaleDateString()}` : "No expiry"}
                            </div>
                          </td>

                          <td className="p-3">
                            <div className="flex items-center justify-between text-[10px] font-medium text-slate-300 mb-1">
                              <span>{redCount} uses</span>
                              <span>{limitCount ? `${limitCount} max` : "Unlimited"}</span>
                            </div>
                            {limitCount ? (
                              <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-pink-500 to-rose-500 rounded-full"
                                  style={{ width: `${usagePercent}%` }}
                                />
                              </div>
                            ) : (
                              <div className="text-[10px] text-emerald-400 font-medium">Active Capless</div>
                            )}
                          </td>

                          <td className="p-3 text-right">
                            <div className="font-bold text-emerald-400">
                              ₹{(Number(o.total_revenue_generated) || 0).toLocaleString()}
                            </div>
                            <div className="text-[10px] text-rose-400">
                              -₹{(Number(o.total_discount_given) || 0).toLocaleString()}
                            </div>
                          </td>

                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleToggleStatus(o)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all ${
                                o.status === "active"
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
                                  : o.status === "scheduled"
                                  ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                                  : "bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700"
                              }`}
                            >
                              {o.status}
                            </button>
                          </td>

                          <td className="p-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setSelectedCouponId(o.id);
                                  setDrawerOpen(true);
                                }}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Configure Coupon"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleCloneCoupon(o.id)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                                title="Clone Coupon"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteOffer(o.id, o.code)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-400 transition-colors"
                                title="Delete Coupon"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: LIVE PERFORMANCE & BRANCH ROI */}
      {activeSubTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 bg-slate-900/80 rounded-xl border border-slate-800">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Top Performing Coupon
              </h3>
              {analytics?.top_coupon ? (
                <div>
                  <div className="text-xl font-bold text-white font-mono text-pink-400">
                    {analytics.top_coupon.code}
                  </div>
                  <div className="text-xs text-slate-300 mt-1">{analytics.top_coupon.name}</div>
                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-between text-xs">
                    <span className="text-slate-400">Redemptions:</span>
                    <span className="font-bold text-white">{analytics.top_coupon.redemptions}</span>
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-slate-400">Sales Generated:</span>
                    <span className="font-bold text-emerald-400">₹{(analytics.top_coupon.revenue || 0).toLocaleString()}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500 py-6 text-center">No coupon redemptions recorded yet</div>
              )}
            </div>

            <div className="p-5 bg-slate-900/80 rounded-xl border border-slate-800 md:col-span-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Branch-wise Promotion Breakdown
              </h3>
              <div className="space-y-3">
                {analytics?.branch_performance && analytics.branch_performance.length > 0 ? (
                  analytics.branch_performance.map((b: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{b.branch_name || b.name}</div>
                        <div className="text-[10px] text-slate-400">{b.redemptions} orders redeemed</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-400">₹{(b.revenue || 0).toLocaleString()}</div>
                        <div className="text-[10px] text-rose-400">-₹{(b.discount || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-xs text-slate-500 bg-slate-950 rounded-lg border border-slate-800">
                    No branch promotion orders recorded yet. Redemptions will automatically appear here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: REAL-TIME CUSTOMER REDEMPTION FEED */}
      {activeSubTab === "feed" && (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer Phone / ID</th>
                  <th className="p-3">Order Number</th>
                  <th className="p-3">Branch / City</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Discount Given</th>
                  <th className="p-3 text-right">Order Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/40">
                {redemptionsFeed.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-500">
                      <Users className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                      <div className="text-sm font-semibold text-slate-400">No customer coupon redemptions recorded yet</div>
                      <p className="text-xs text-slate-600 mt-1">Real-time redemptions from checkout will populate this feed automatically.</p>
                    </td>
                  </tr>
                ) : (
                  redemptionsFeed.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="p-3 text-slate-400">{new Date(item.created_at || Date.now()).toLocaleString()}</td>
                      <td className="p-3 font-medium text-white">{item.customer_phone || item.customer_id || "Guest"}</td>
                      <td className="p-3 font-mono text-pink-400">{item.order_number || item.order_id || "—"}</td>
                      <td className="p-3">{item.branch_name || item.city || "Kollam"}</td>
                      <td className="p-3">{item.payment_method || "UPI"}</td>
                      <td className="p-3 text-right font-bold text-rose-400">₹{item.discount_amount || 0}</td>
                      <td className="p-3 text-right font-bold text-emerald-400">₹{item.order_total || 0}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: BULK IMPORT */}
      {activeSubTab === "import" && (
        <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-pink-400" />
            <h3 className="text-sm font-bold text-white">Bulk Coupon CSV Import</h3>
          </div>
          <p className="text-xs text-slate-400">
            Paste raw CSV content below. Header must contain: <code>code,name,type,discount_value,min_order,usage_limit</code>
          </p>

          <textarea
            rows={8}
            value={importCsvText}
            onChange={(e) => setImportCsvText(e.target.value)}
            placeholder="code,name,type,discount_value,min_order,usage_limit&#10;SUMMER20,Summer 20% Off,percentage,20,499,1000&#10;SWEET50,Sweet Fifty Flat,flat,50,399,500"
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white font-mono focus:outline-none focus:border-pink-500"
          />

          <div className="flex justify-end">
            <button
              onClick={handleImportSubmit}
              disabled={importing || !importCsvText.trim()}
              className="px-5 py-2 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-pink-500/25 transition-all disabled:opacity-50"
            >
              {importing ? "Importing Coupons..." : "Execute Bulk Import"}
            </button>
          </div>
        </div>
      )}

      {/* Slide-Over Coupon Management Drawer */}
      <CouponDrawer
        isOpen={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCouponId(null);
        }}
        couponId={selectedCouponId}
        onSaveSuccess={fetchMarketingData}
      />
    </div>
  );
});
