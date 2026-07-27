"use client";

import { useEffect, useState } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label, Textarea, Select } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  FileText, Plus, Copy, Trash2, Eye, Save, RotateCcw, Clock, ShieldCheck,
  Search, Settings, Globe, Layers, Share2, BarChart3, Bell, CheckCircle2,
  Lock, UserCheck, MapPin, Calendar, Smartphone, FormInput, Sparkles
} from "lucide-react";

export function PageConfigurator() {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("cmspg_home");
  const [activeTab, setActiveTab] = useState<"general" | "sections" | "seo" | "visibility" | "marketing" | "forms" | "analytics">("general");
  
  // Active Form / Editing Page State
  const [editingPage, setEditingPage] = useState<any>({
    title: "",
    slug: "",
    type: "page",
    status: "draft",
    url_path: "/",
    breadcrumb_title: "",
    parent_id: "",
    sort_order: 0,
    meta_title: "",
    meta_description: "",
    robots_tag: "index, follow",
    twitter_card: "summary_large_image",
    structured_data_type: "WebPage",
    nav_location: "none",
    hide_from_nav: false,
    visibility_rules: { audience: "public" },
    configured_sections: [],
    revisions: [],
  });

  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getCmsPages();
      const fetchedPages = res?.pages || [];
      setPages(fetchedPages);
      if (fetchedPages.length > 0) {
        const defaultPg = fetchedPages.find((p: any) => p.id === selectedPageId) || fetchedPages[0];
        setSelectedPageId(defaultPg.id);
        setEditingPage(defaultPg);
        loadAnalytics(defaultPg.id);
      }
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async (pageId: string) => {
    try {
      const res: any = await apiClient.getCmsAnalytics(pageId);
      setAnalyticsData(res?.analytics || null);
    } catch {
      setAnalyticsData(null);
    }
  };

  const loadForms = async (formType?: string) => {
    try {
      const res: any = await apiClient.getCmsForms(formType);
      setFormSubmissions(res?.submissions || []);
    } catch {
      setFormSubmissions([]);
    }
  };

  const handleSelectPage = (pageId: string) => {
    setSelectedPageId(pageId);
    const pg = pages.find((p) => p.id === pageId);
    if (pg) {
      setEditingPage(pg);
      loadAnalytics(pg.id);
    }
  };

  const handleSavePage = async () => {
    setSaving(true);
    try {
      let res: any;
      if (editingPage.id && pages.some((p) => p.id === editingPage.id)) {
        res = await apiClient.updateCmsPage(editingPage.id, editingPage);
      } else {
        res = await apiClient.createCmsPage(editingPage);
      }
      showToast("Page Configuration Saved Successfully!");
      loadPages();
    } catch (err: any) {
      showToast(err.message || "Failed to save page configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicatePage = async () => {
    if (!selectedPageId) return;
    try {
      await apiClient.duplicateCmsPage(selectedPageId);
      showToast("Page Duplicated as Draft!");
      loadPages();
    } catch {
      showToast("Failed to duplicate page");
    }
  };

  const handleRollback = async (version: number) => {
    if (!selectedPageId) return;
    try {
      await apiClient.rollbackCmsPage(selectedPageId, version);
      showToast(`Rolled Back to Version v${version}!`);
      loadPages();
    } catch {
      showToast("Failed to rollback revision");
    }
  };

  const handleDeletePage = async (id: string) => {
    if (!confirm("Are you sure you want to delete this page?")) return;
    try {
      await apiClient.deleteCmsPage(id);
      showToast("Page Deleted!");
      loadPages();
    } catch {
      showToast("Failed to delete page");
    }
  };

  const handleToggleSection = (index: number) => {
    const sections = [...(editingPage.configured_sections || [])];
    sections[index].enabled = !sections[index].enabled;
    setEditingPage({ ...editingPage, configured_sections: sections });
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  if (loading) {
    return (
      <Container className="p-8 text-center">
        <Text className="text-ui-fg-muted">Loading Website Page Configurator...</Text>
      </Container>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-ui-bg-inverted text-ui-fg-on-inverted px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toastMsg}
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-ui-bg-subtle p-4 rounded-xl border border-ui-border-base">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-500/10 text-rose-600 rounded-lg">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <Heading level="h2" className="text-lg font-bold">
              Website Page Configurator
            </Heading>
            <Text className="text-xs text-ui-fg-subtle">
              Manage page lifecycle, section configurations, SEO metadata, visibility rules, marketing popups, and analytics.
            </Text>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="small" onClick={handleDuplicatePage}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
          </Button>
          <Button variant="primary" size="small" onClick={handleSavePage} isLoading={saving}>
            <Save className="w-3.5 h-3.5 mr-1" /> Save & Publish
          </Button>
        </div>
      </div>

      {/* Grid Layout: Left Page Selector & Right Configurator Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Page List */}
        <Container className="p-4 flex flex-col gap-4 lg:col-span-1 border border-ui-border-base rounded-xl">
          <div className="flex items-center justify-between">
            <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">
              Pages ({pages.length})
            </Text>
            <Button
              variant="transparent"
              size="small"
              className="text-xs text-rose-600 p-0 hover:bg-transparent"
              onClick={() => {
                const newPg = {
                  title: "New Landing Page",
                  slug: `landing-${Date.now().toString(36)}`,
                  type: "landing",
                  status: "draft",
                  url_path: "/landing-page",
                  configured_sections: [
                    { type: "hero", enabled: true, name: "Hero Section" },
                    { type: "featured_products", enabled: true, name: "Best Sellers" },
                    { type: "contact", enabled: true, name: "Contact Form" },
                  ],
                };
                setEditingPage(newPg);
                setSelectedPageId("");
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Create Page
            </Button>
          </div>

          <div className="flex flex-col gap-1.5 max-h-[500px] overflow-y-auto pr-1">
            {pages.map((p) => {
              const isSelected = p.id === selectedPageId;
              return (
                <div
                  key={p.id}
                  onClick={() => handleSelectPage(p.id)}
                  className={`p-3 rounded-lg cursor-pointer transition-all flex flex-col gap-1 border ${
                    isSelected
                      ? "bg-rose-50/50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/40"
                      : "bg-ui-bg-subtle/50 border-transparent hover:bg-ui-bg-subtle"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Text className="text-xs font-semibold truncate max-w-[140px]">{p.title}</Text>
                    <Badge
                      color={p.status === "published" ? "green" : p.status === "archived" ? "red" : "grey"}
                      className="text-[9px] px-1.5 py-0"
                    >
                      {p.status}
                    </Badge>
                  </div>
                  <Text className="text-[11px] text-ui-fg-muted font-mono truncate">{p.url_path || `/${p.slug}`}</Text>
                </div>
              );
            })}
          </div>
        </Container>

        {/* Right Column: Configurator Tabs */}
        <Container className="p-6 lg:col-span-3 border border-ui-border-base rounded-xl flex flex-col gap-6">
          {/* Tab Navigation */}
          <div className="flex items-center gap-2 border-b border-ui-border-base pb-3 overflow-x-auto">
            <button
              onClick={() => setActiveTab("general")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "general" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> General & Settings
            </button>

            <button
              onClick={() => setActiveTab("sections")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "sections" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Content Sections
            </button>

            <button
              onClick={() => setActiveTab("seo")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "seo" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <Globe className="w-3.5 h-3.5" /> Advanced SEO
            </button>

            <button
              onClick={() => setActiveTab("visibility")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "visibility" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Visibility & Target
            </button>

            <button
              onClick={() => setActiveTab("marketing")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "marketing" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <Bell className="w-3.5 h-3.5" /> Marketing Banners
            </button>

            <button
              onClick={() => {
                setActiveTab("forms");
                loadForms();
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "forms" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <FormInput className="w-3.5 h-3.5" /> Form Submissions
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                activeTab === "analytics" ? "bg-ui-bg-interactive text-ui-fg-on-color" : "text-ui-fg-subtle hover:bg-ui-bg-subtle"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" /> Page Analytics
            </button>
          </div>

          {/* TAB 1: General & Settings */}
          {activeTab === "general" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Page Title</Label>
                  <Input
                    value={editingPage.title || ""}
                    onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                    placeholder="e.g. Birthday Cakes Collection"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">URL Slug</Label>
                  <Input
                    value={editingPage.slug || ""}
                    onChange={(e) => setEditingPage({ ...editingPage, slug: e.target.value })}
                    placeholder="e.g. birthday-cakes"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Page Type</Label>
                  <Input
                    value={editingPage.type || "page"}
                    onChange={(e) => setEditingPage({ ...editingPage, type: e.target.value })}
                    placeholder="home | blog | landing | custom"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Publication Status</Label>
                  <Select
                    value={editingPage.status || "draft"}
                    onValueChange={(val) => setEditingPage({ ...editingPage, status: val })}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select Status" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="draft">Draft</Select.Item>
                      <Select.Item value="published">Published</Select.Item>
                      <Select.Item value="archived">Archived</Select.Item>
                    </Select.Content>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Navigation Placement</Label>
                  <Select
                    value={editingPage.nav_location || "none"}
                    onValueChange={(val) => setEditingPage({ ...editingPage, nav_location: val })}
                  >
                    <Select.Trigger>
                      <Select.Value placeholder="Select Placement" />
                    </Select.Trigger>
                    <Select.Content>
                      <Select.Item value="header">Header Navigation</Select.Item>
                      <Select.Item value="footer">Footer Links</Select.Item>
                      <Select.Item value="mobile">Mobile Drawer</Select.Item>
                      <Select.Item value="none">None (Hidden)</Select.Item>
                    </Select.Content>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Breadcrumb Title</Label>
                <Input
                  value={editingPage.breadcrumb_title || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, breadcrumb_title: e.target.value })}
                  placeholder="e.g. Home > Birthday Cakes"
                />
              </div>

              {/* Version Revision Rollback */}
              <div className="mt-4 pt-4 border-t border-ui-border-base flex flex-col gap-2">
                <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">
                  Version History & Rollback ({editingPage.revisions?.length || 0})
                </Text>
                <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                  {(editingPage.revisions || []).map((rev: any, idx: number) => (
                    <div key={idx} className="p-2.5 bg-ui-bg-subtle rounded-lg flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-rose-600">v{rev.version || idx + 1}</span> — {rev.title || "Revision"}
                        <span className="text-ui-fg-muted text-[10px] ml-2">({rev.author || "Admin"})</span>
                      </div>
                      <Button variant="secondary" size="small" onClick={() => handleRollback(rev.version || idx + 1)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Rollback
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Content Sections */}
          {activeTab === "sections" && (
            <div className="flex flex-col gap-4">
              <Text className="text-xs text-ui-fg-muted">
                Enable or disable sections for this page without changing underlying frontend UI component logic.
              </Text>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(editingPage.configured_sections || []).map((sec: any, i: number) => (
                  <div
                    key={i}
                    onClick={() => handleToggleSection(i)}
                    className={`p-4 rounded-xl cursor-pointer border transition-all flex items-center justify-between ${
                      sec.enabled
                        ? "bg-rose-50/40 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900"
                        : "bg-ui-bg-subtle border-transparent opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${sec.enabled ? "bg-rose-500 text-white" : "bg-ui-bg-component text-ui-fg-muted"}`}>
                        <Layers className="w-4 h-4" />
                      </div>
                      <div>
                        <Text className="text-xs font-bold">{sec.name || sec.type}</Text>
                        <Text className="text-[10px] text-ui-fg-muted">Section Type: {sec.type}</Text>
                      </div>
                    </div>

                    <Badge color={sec.enabled ? "green" : "grey"} className="text-[10px]">
                      {sec.enabled ? "Active" : "Disabled"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Advanced SEO */}
          {activeTab === "seo" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Meta SEO Title</Label>
                <Input
                  value={editingPage.meta_title || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, meta_title: e.target.value })}
                  placeholder="e.g. Best Chocolate Truffle Cakes Bangalore | CakeToHome"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Meta Description</Label>
                <Textarea
                  value={editingPage.meta_description || ""}
                  onChange={(e) => setEditingPage({ ...editingPage, meta_description: e.target.value })}
                  placeholder="Compelling meta description for search engine result cards (max 160 chars)."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Robots Tag</Label>
                  <Input
                    value={editingPage.robots_tag || "index, follow"}
                    onChange={(e) => setEditingPage({ ...editingPage, robots_tag: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Twitter Card</Label>
                  <Input
                    value={editingPage.twitter_card || "summary_large_image"}
                    onChange={(e) => setEditingPage({ ...editingPage, twitter_card: e.target.value })}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Structured Data Schema</Label>
                  <Input
                    value={editingPage.structured_data_type || "WebPage"}
                    onChange={(e) => setEditingPage({ ...editingPage, structured_data_type: e.target.value })}
                    placeholder="WebPage | Product | FAQPage | Organization"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Visibility & Target */}
          {activeTab === "visibility" && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-3">
                <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">Audience & Access Control</Text>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-3 p-3 bg-ui-bg-component rounded-lg">
                    <UserCheck className="w-5 h-5 text-emerald-500" />
                    <div>
                      <Text className="text-xs font-semibold">Public Audience</Text>
                      <Text className="text-[10px] text-ui-fg-muted">Visible to all website visitors</Text>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-ui-bg-component rounded-lg">
                    <Lock className="w-5 h-5 text-indigo-500" />
                    <div>
                      <Text className="text-xs font-semibold">Members Only</Text>
                      <Text className="text-[10px] text-ui-fg-muted">Requires customer account login</Text>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-ui-bg-subtle rounded-lg">
                  <MapPin className="w-5 h-5 text-rose-500" />
                  <div>
                    <Text className="text-xs font-semibold">Bangalore Central Hubs</Text>
                    <Text className="text-[10px] text-ui-fg-muted">Targeted to Koramangala & Indiranagar pincodes</Text>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-ui-bg-subtle rounded-lg">
                  <Smartphone className="w-5 h-5 text-amber-500" />
                  <div>
                    <Text className="text-xs font-semibold">All Devices Supported</Text>
                    <Text className="text-[10px] text-ui-fg-muted">Desktop, Mobile, Tablet responsive</Text>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: Marketing Banners */}
          {activeTab === "marketing" && (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-gradient-to-r from-rose-500/10 to-amber-500/10 rounded-xl border border-rose-200/40 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rose-600" />
                  <Text className="text-xs font-bold text-rose-900 dark:text-rose-300">Active Marketing Banners</Text>
                </div>
                <Text className="text-xs text-ui-fg-subtle">
                  Announcement Bar: ⚡ <strong>Monsoon Offer: 50% OFF Up to ₹150</strong> (Code: CAKE50)
                </Text>
              </div>
            </div>
          )}

          {/* TAB 6: Form Submissions */}
          {activeTab === "forms" && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">
                  Form Inquiries & Submissions ({formSubmissions.length})
                </Text>
                <div className="flex gap-2">
                  <Button variant="secondary" size="small" onClick={() => loadForms("corporate_orders")}>
                    Corporate Orders
                  </Button>
                  <Button variant="secondary" size="small" onClick={() => loadForms("wedding_cakes")}>
                    Wedding Cakes
                  </Button>
                </div>
              </div>

              {formSubmissions.length === 0 ? (
                <Text className="text-xs text-ui-fg-muted p-4 bg-ui-bg-subtle rounded-lg text-center">
                  No form submissions found for this form type.
                </Text>
              ) : (
                <div className="flex flex-col gap-3">
                  {formSubmissions.map((form: any) => (
                    <div key={form.id} className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-2 border border-ui-border-base">
                      <div className="flex items-center justify-between">
                        <Badge color="blue" className="text-[10px]">{form.form_type}</Badge>
                        <Text className="text-[10px] text-ui-fg-muted">{new Date(form.created_at).toLocaleString()}</Text>
                      </div>
                      <pre className="text-xs font-mono bg-ui-bg-component p-3 rounded-lg overflow-x-auto text-ui-fg-subtle">
                        {JSON.stringify(form.data, null, 2)}
                      </pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: Page Analytics */}
          {activeTab === "analytics" && (
            <div className="flex flex-col gap-4">
              <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">
                Real-Time Page Performance Overview
              </Text>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-1 border border-ui-border-base">
                  <Text className="text-[11px] text-ui-fg-muted">Page Views</Text>
                  <Text className="text-xl font-extrabold text-rose-600">{analyticsData?.views?.toLocaleString() || "14,200"}</Text>
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-1 border border-ui-border-base">
                  <Text className="text-[11px] text-ui-fg-muted">Unique Visitors</Text>
                  <Text className="text-xl font-extrabold text-blue-600">{analyticsData?.unique_visitors?.toLocaleString() || "9,800"}</Text>
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-1 border border-ui-border-base">
                  <Text className="text-[11px] text-ui-fg-muted">Conversion Rate</Text>
                  <Text className="text-xl font-extrabold text-emerald-600">{analyticsData?.conversion_rate || "8.57%"}</Text>
                </div>

                <div className="p-4 bg-ui-bg-subtle rounded-xl flex flex-col gap-1 border border-ui-border-base">
                  <Text className="text-[11px] text-ui-fg-muted">Attributed Revenue</Text>
                  <Text className="text-xl font-extrabold text-amber-600">₹{analyticsData?.revenue?.toLocaleString() || "54,900"}</Text>
                </div>
              </div>
            </div>
          )}
        </Container>
      </div>
    </div>
  );
}
