"use client";

import { useEffect, useState, useCallback, memo } from "react";
import {
  Container,
  Heading,
  Text,
  Badge,
  Button,
  Input,
  StatusBadge,
} from "@medusajs/ui";
import {
  Sparkles,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Edit,
  Trash2,
  Copy,
  Archive,
  Play,
  Pause,
  Eye,
  TrendingUp,
  Percent,
  IndianRupee,
  Users,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Layers,
} from "lucide-react";
import { apiClient } from "@frontend/lib/api-client";
import { PopupCampaign, CampaignStatus, PopupType } from "@frontend/lib/engagement/types";
import { PopupEditorDrawer } from "./popup-editor-drawer";

export const PopupsPanel = memo(function PopupsPanel() {
  const [campaigns, setCampaigns] = useState<PopupCampaign[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [options, setOptions] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<PopupCampaign | null>(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      if (typeFilter !== "all") params.popup_type = typeFilter;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      const [popupsRes, analyticsRes, optionsRes] = await Promise.all([
        apiClient.getAdminPopups(params),
        apiClient.getAdminPopupAnalytics(params),
        apiClient.getAdminPopupOptions(),
      ]);

      setCampaigns(popupsRes.campaigns || []);
      setAnalytics(analyticsRes.summary || null);
      setOptions(optionsRes || {});
    } catch (err: any) {
      showToast(err.message || "Failed to load popup campaigns", "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateNew = () => {
    setEditingCampaign(null);
    setDrawerOpen(true);
  };

  const handleEdit = (campaign: PopupCampaign) => {
    setEditingCampaign(campaign);
    setDrawerOpen(true);
  };

  const handlePublish = async (id: string, name: string) => {
    try {
      const res: any = await apiClient.publishAdminPopup(id);
      if (res?.success || res?.campaign) {
        showToast(`Published "${name}" successfully!`);
        loadData();
      } else {
        throw new Error(res?.error || "Failed to publish");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to publish campaign", "error");
    }
  };

  const handlePause = async (id: string, name: string) => {
    try {
      const res: any = await apiClient.pauseAdminPopup(id);
      if (res?.success || res?.campaign) {
        showToast(`Paused "${name}".`);
        loadData();
      } else {
        throw new Error(res?.error || "Failed to pause");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to pause campaign", "error");
    }
  };

  const handleArchive = async (id: string, name: string) => {
    if (!confirm(`Archive popup campaign "${name}"? It will no longer display on the storefront.`)) return;
    try {
      const res: any = await apiClient.archiveAdminPopup(id);
      if (res?.success || res?.campaign) {
        showToast(`Archived "${name}".`);
        loadData();
      } else {
        throw new Error(res?.error || "Failed to archive");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to archive campaign", "error");
    }
  };

  const handleDuplicate = async (id: string, name: string) => {
    try {
      const res: any = await apiClient.duplicateAdminPopup(id);
      if (res?.success || res?.campaign) {
        showToast(`Duplicated "${name}" into draft copy!`);
        loadData();
      } else {
        throw new Error(res?.error || "Failed to duplicate");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate campaign", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Permanently delete popup campaign "${name}"? This action cannot be undone.`)) return;
    try {
      const res: any = await apiClient.deleteAdminPopup(id);
      if (res?.success || res?.deleted) {
        showToast(`Deleted "${name}".`);
        loadData();
      } else {
        throw new Error(res?.error || "Failed to delete");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to delete campaign", "error");
    }
  };

  const getStatusBadgeColor = (status: CampaignStatus) => {
    switch (status) {
      case "published":
        return "green";
      case "draft":
        return "grey";
      case "paused":
        return "orange";
      case "archived":
        return "red";
      default:
        return "grey";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Heading level="h2" className="text-xl font-bold">
              🎯 Popup & Storefront Engagement Manager
            </Heading>
            <Badge color="purple" className="flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Realtime AST Rule Engine
            </Badge>
          </div>
          <Text className="text-ui-fg-subtle text-sm mt-0.5">
            Configure, arbitrate, and publish high-converting exit-intent modals, welcome offers, and cart recovery prompts.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="small"
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Button
            variant="primary"
            size="small"
            onClick={handleCreateNew}
            className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 text-xs shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Create Popup Campaign
          </Button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`p-3 rounded-lg border text-xs font-medium flex items-center gap-2 shadow-sm animate-fade-in ${
            toastMsg.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          {toastMsg.type === "success" ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Active Campaigns
          </Text>
          <Text className="text-2xl font-bold">
            {campaigns.filter((c) => c.status === "published").length}
          </Text>
          <Text className="text-[10px] text-emerald-600 font-medium">
            {campaigns.length} total in pipeline
          </Text>
        </Container>

        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Total Impressions
          </Text>
          <Text className="text-2xl font-bold">
            {(analytics?.total_impressions || 0).toLocaleString()}
          </Text>
          <Text className="text-[10px] text-ui-fg-muted">Storefront displays</Text>
        </Container>

        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Avg Click Rate (CTR)
          </Text>
          <Text className="text-2xl font-bold text-blue-600">
            {analytics?.overall_ctr || 0}%
          </Text>
          <Text className="text-[10px] text-ui-fg-muted">CTA engagements</Text>
        </Container>

        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Conversion Rate
          </Text>
          <Text className="text-2xl font-bold text-emerald-600">
            {analytics?.overall_conversion_rate || 0}%
          </Text>
          <Text className="text-[10px] text-ui-fg-muted">
            {analytics?.total_conversions || 0} completed purchases
          </Text>
        </Container>

        <Container className="p-4 flex flex-col gap-1">
          <Text className="text-[11px] font-semibold text-ui-fg-subtle uppercase tracking-wider">
            Recovered Revenue
          </Text>
          <Text className="text-2xl font-bold text-purple-600">
            ₹{(analytics?.total_revenue || 0).toLocaleString()}
          </Text>
          <Text className="text-[10px] text-emerald-600 font-medium">
            Directly attributed
          </Text>
        </Container>
      </div>

      {/* Filter & Search Bar */}
      <Container className="p-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-ui-fg-muted absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by campaign name, headline, slug..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published (Active)</option>
              <option value="draft">Drafts</option>
              <option value="paused">Paused</option>
              <option value="archived">Archived</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-8 px-2.5 text-xs rounded-md bg-ui-bg-field border border-ui-border-base focus:border-ui-border-interactive focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="WELCOME">Welcome Offer</option>
              <option value="CART_EXIT">Cart Exit Recovery</option>
              <option value="PRODUCT_EXIT">Product Exit</option>
              <option value="LOGIN">Smart Login</option>
              <option value="WISHLIST_AUTH">Wishlist Guard</option>
              <option value="RETURNING">Returning Customer</option>
              <option value="PROMOTIONAL">Promotional</option>
              <option value="MEMBER">VIP Member</option>
            </select>
          </div>
        </div>
      </Container>

      {/* Campaigns Data Table */}
      <Container className="p-0 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-ui-border-base bg-ui-bg-subtle">
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle">Campaign Details</th>
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle">Trigger & Audience</th>
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle text-center">Priority</th>
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle text-center">Status</th>
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle text-right">Performance</th>
                <th className="p-3.5 text-xs font-semibold text-ui-fg-subtle text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-ui-fg-muted text-xs">
                    Loading popup campaigns...
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-ui-fg-muted">
                    <div className="flex flex-col items-center gap-2 max-w-sm mx-auto">
                      <Sparkles className="w-8 h-8 text-ui-fg-muted" />
                      <Text className="font-semibold text-sm text-ui-fg-base">No Popup Campaigns Found</Text>
                      <Text className="text-xs text-ui-fg-subtle">
                        {searchQuery || statusFilter !== "all" || typeFilter !== "all"
                          ? "No popups match the current filter criteria."
                          : "Get started by creating your first conversion-focused popup campaign."}
                      </Text>
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={handleCreateNew}
                        className="mt-2 text-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Popup
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => {
                  const v = camp.draft_version || camp.current_version;
                  const isPublished = camp.status === "published";
                  return (
                    <tr
                      key={camp.id}
                      className="border-b border-ui-border-base hover:bg-ui-bg-subtle-hover transition-colors"
                    >
                      {/* Campaign Details */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-ui-fg-base hover:text-rose-600 transition-colors">
                              {camp.name}
                            </span>
                            <Badge color="purple" className="text-[10px] px-1.5 py-0">
                              {camp.popup_type}
                            </Badge>
                          </div>
                          <span className="text-[11px] text-ui-fg-subtle truncate max-w-xs">
                            {v?.content?.headline || camp.description || "No headline set"}
                          </span>
                          <span className="text-[10px] text-ui-fg-muted font-mono">
                            slug: {camp.slug}
                          </span>
                        </div>
                      </td>

                      {/* Trigger & Audience */}
                      <td className="p-3.5">
                        <div className="flex flex-col gap-1 text-xs text-ui-fg-subtle">
                          <div className="flex items-center gap-1.5">
                            {v?.trigger?.exitIntent && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 text-[10px] font-medium">
                                Exit Intent
                              </span>
                            )}
                            {typeof v?.trigger?.timeOnPageSeconds === "number" && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">
                                {v.trigger.timeOnPageSeconds}s Delay
                              </span>
                            )}
                            {v?.trigger?.scrollDepthPercent && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 text-[10px] font-medium">
                                {v.trigger.scrollDepthPercent}% Scroll
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-ui-fg-muted">
                            Audience:{" "}
                            {v?.audience?.customerStatus?.join(", ") || "All Personas"} •{" "}
                            {v?.audience?.devices?.join(", ") || "All Devices"}
                          </div>
                        </div>
                      </td>

                      {/* Priority */}
                      <td className="p-3.5 text-center">
                        <span className="px-2 py-0.5 rounded-full bg-ui-bg-subtle text-ui-fg-base font-bold text-xs">
                          {camp.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        <Badge
                          color={getStatusBadgeColor(camp.status)}
                          className="text-[10px] capitalize"
                        >
                          {camp.status}
                        </Badge>
                      </td>

                      {/* Performance */}
                      <td className="p-3.5 text-right">
                        <div className="flex flex-col gap-0.5 items-end">
                          <span className="text-xs font-semibold text-ui-fg-base">
                            {camp.analytics?.impressions || 0} views • {camp.analytics?.clicks || 0} clicks
                          </span>
                          <span className="text-[10px] text-emerald-600 font-medium">
                            {camp.analytics?.ctr || 0}% CTR • {camp.analytics?.conversions || 0} orders
                          </span>
                          {(camp.analytics?.recovered_revenue || 0) > 0 && (
                            <span className="text-[10px] text-purple-600 font-bold">
                              ₹{(camp.analytics?.recovered_revenue || 0).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleEdit(camp)}
                            title="Edit Campaign"
                            className="p-1.5 h-7 w-7 text-ui-fg-subtle hover:text-ui-fg-base"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>

                          {isPublished ? (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handlePause(camp.id, camp.name)}
                              title="Pause Campaign"
                              className="p-1.5 h-7 w-7 text-amber-600 hover:text-amber-700"
                            >
                              <Pause className="w-3.5 h-3.5" />
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="small"
                              onClick={() => handlePublish(camp.id, camp.name)}
                              title="Publish Campaign"
                              className="p-1.5 h-7 w-7 text-emerald-600 hover:text-emerald-700"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </Button>
                          )}

                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleDuplicate(camp.id, camp.name)}
                            title="Duplicate Campaign"
                            className="p-1.5 h-7 w-7 text-ui-fg-subtle hover:text-ui-fg-base"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleArchive(camp.id, camp.name)}
                            title="Archive Campaign"
                            className="p-1.5 h-7 w-7 text-ui-fg-subtle hover:text-ui-fg-base"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>

                          <Button
                            variant="secondary"
                            size="small"
                            onClick={() => handleDelete(camp.id, camp.name)}
                            title="Delete Campaign"
                            className="p-1.5 h-7 w-7 text-rose-600 hover:text-rose-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Container>

      {/* Editor Drawer Modal */}
      <PopupEditorDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        campaign={editingCampaign}
        onSaved={(_saved) => {
          showToast(`Popup "${_saved.name}" saved successfully!`);
          loadData();
        }}
        options={options}
      />
    </div>
  );
});
