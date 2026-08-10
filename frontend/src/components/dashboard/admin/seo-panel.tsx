"use client";

import { useEffect, useState, memo, useCallback } from "react";
import { Container, Heading, Text, Badge, Button, Input, Label, Textarea, Table } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Search, Globe, Share2, Code, Copy, Check, Save, RefreshCw, Layers, MapPin,
  HelpCircle, Image as ImageIcon, Zap, Link2, Sparkles, AlertTriangle, ShieldCheck,
  TrendingUp, FileText, ArrowRight, Trash2, Plus, Download, Upload, CheckCircle2,
  Lock, Eye, Wrench, Play, CheckSquare, Server, FileCode, Users, Activity
} from "lucide-react";
import { WidgetErrorBoundary } from "./error-boundary";
import { FormSkeleton } from "./admin-skeletons";

const SEO_SUB_TABS = [
  { id: "overview", label: "Dashboard & KPIs", icon: Globe },
  { id: "pages", label: "Page SEO Manager", icon: Layers },
  { id: "keywords", label: "Keyword Trajectories", icon: TrendingUp },
  { id: "redirects", label: "Redirect Validator", icon: Link2 },
  { id: "geo", label: "GEO & Local SEO", icon: MapPin },
  { id: "aeo", label: "AEO & Answer Engine", icon: HelpCircle },
  { id: "schema", label: "Structured Data", icon: Code },
  { id: "audits", label: "Audit & Auto-Fix", icon: AlertTriangle },
  { id: "crawler", label: "Live HTTP Crawler", icon: Play },
  { id: "links", label: "Internal Link Graph", icon: Activity },
  { id: "speed", label: "Core Web Vitals", icon: Zap },
  { id: "integrations", label: "Integrations & APIs", icon: Server },
  { id: "utm", label: "UTM Builder", icon: Share2 },
  { id: "robots", label: "Robots & Sitemaps", icon: ShieldCheck },
  { id: "ai", label: "AI SEO Generator", icon: Sparkles },
  { id: "audit_logs", label: "Immutable Audit Logs", icon: FileText },
] as const;

type SeoSubTabId = (typeof SEO_SUB_TABS)[number]["id"];

export const SeoPanel = memo(function SeoPanel() {
  const [activeTab, setActiveTab] = useState<SeoSubTabId>("overview");
  const [userRole, setUserRole] = useState<string>("super_admin");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Global Config
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [keywords, setKeywords] = useState("");
  const [canonicalUrl, setCanonicalUrl] = useState("");
  const [ogImage, setOgImage] = useState("");
  const [gaId, setGaId] = useState("");
  const [fbPixelId, setFbPixelId] = useState("");
  const [gtmId, setGtmId] = useState("");
  const [robotsTxt, setRobotsTxt] = useState("");
  const [schemaType, setSchemaType] = useState("Bakery");

  // Summary & Data States
  const [summary, setSummary] = useState<any>(null);
  const [pages, setPages] = useState<any[]>([]);
  const [pageSearch, setPageSearch] = useState("");
  const [pageEntityType, setPageEntityType] = useState("all");

  const [keywordsList, setKeywordsList] = useState<any[]>([]);
  const [kwTrajectories, setKwTrajectories] = useState<any>(null);
  const [newKw, setNewKw] = useState({ keyword: "", search_volume: 1000, difficulty: 30, target_url: "" });

  const [redirectsList, setRedirectsList] = useState<any[]>([]);
  const [redirectValidation, setRedirectValidation] = useState<any[]>([]);
  const [newRedirect, setNewRedirect] = useState({ source_url: "", target_url: "", status_code: 301 });

  const [geoPages, setGeoPages] = useState<any[]>([]);
  const [newGeo, setNewGeo] = useState({ city: "Kollam", area: "", page_type: "city" });

  const [aeoEntries, setAeoEntries] = useState<any[]>([]);
  const [newAeo, setNewAeo] = useState({ question: "", answer: "", entry_type: "faq" });

  const [jsonLdInput, setJsonLdInput] = useState(`{\n  "@context": "https://schema.org",\n  "@type": "Bakery",\n  "name": "CakeToHome Bakery"\n}`);
  const [jsonLdValidation, setJsonLdValidation] = useState<any>(null);

  // Audit Issues & Auto-Fix
  const [auditIssues, setAuditIssues] = useState<any[]>([]);
  const [linkGraph, setLinkGraph] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any[]>([]);

  // Live Crawler
  const [crawlResults, setCrawlResults] = useState<any>(null);

  // Integrations & APIs
  const [gscData, setGscData] = useState<any>(null);
  const [ga4Data, setGa4Data] = useState<any>(null);
  const [bingUrlInput, setBingUrlInput] = useState("https://cakes2home.com/products");
  const [indexingUrlInput, setIndexingUrlInput] = useState("https://cakes2home.com/cakes/kollam");

  // UTM Generator
  const [utmCampaigns, setUtmCampaigns] = useState<any[]>([]);
  const [utmUrl, setUtmUrl] = useState("https://cakes2home.com/products");
  const [utmSource, setUtmSource] = useState("instagram");
  const [utmMedium, setUtmMedium] = useState("story");
  const [utmCampaign, setUtmCampaign] = useState("monsoon_sale");
  const [copiedUtm, setCopiedUtm] = useState(false);

  // Robots & Sitemap
  const [robotsHistory, setRobotsHistory] = useState<any[]>([]);
  const [robotsSyntax, setRobotsSyntax] = useState<any>(null);
  const [sitemapSyntax, setSitemapSyntax] = useState<any>(null);

  // Audit Logs with Diffs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // AI Assistant
  const [aiContext, setAiContext] = useState({ name: "Belgian Truffle Cake", city: "Kollam", category: "Cakes" });
  const [aiSuggestions, setAiSuggestions] = useState<any>(null);

  // Load All Data
  const fetchAllData = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      apiClient.getAdminSeoConfig(),
      apiClient.getSeoDashboardSummary(),
      apiClient.getSeoPages(),
      apiClient.getSeoKeywords(),
      apiClient.getSeoKeywordTrajectories(),
      apiClient.getSeoRedirects(),
      apiClient.validateSeoRedirects(),
      apiClient.getSeoGeoPages(),
      apiClient.getSeoAeoEntries(),
      apiClient.getSeoAuditIssues(),
      apiClient.getSeoLinkGraph(),
      apiClient.getSeoDuplicates(),
      apiClient.getSeoUtmCampaigns(),
      apiClient.getSeoRobotsHistory(),
      apiClient.getSeoAuditLogs(),
      apiClient.getSeoSearchConsoleData(),
      apiClient.getSeoGa4Data(),
    ])
      .then(([config, sumData, pagesData, kwData, kwTraj, redData, redVal, geoData, aeoData, issData, lgData, dupData, utmData, robData, logData, gsc, ga4]) => {
        if (config) {
          setMetaTitle(config.meta_title || "");
          setMetaDesc(config.meta_description || "");
          setKeywords(config.keywords || "");
          setCanonicalUrl(config.canonical_url || "https://cakes2home.com");
          setOgImage(config.og_image || "");
          setGaId(config.ga_id || "");
          setFbPixelId(config.fb_pixel_id || "");
          setGtmId(config.gtm_id || "");
          setRobotsTxt(config.robots_txt || "User-agent: *\nAllow: /\nSitemap: https://cakes2home.com/sitemap.xml");
          setSchemaType(config.schema_type || "Bakery");
        }
        if (sumData) setSummary(sumData);
        if (pagesData?.pages) setPages(pagesData.pages);
        if (kwData?.keywords) setKeywordsList(kwData.keywords);
        if (kwTraj) setKwTrajectories(kwTraj);
        if (redData?.redirects) setRedirectsList(redData.redirects);
        if (redVal?.validation) setRedirectValidation(redVal.validation);
        if (geoData?.geo_pages) setGeoPages(geoData.geo_pages);
        if (aeoData?.aeo_entries) setAeoEntries(aeoData.aeo_entries);
        if (issData?.issues) setAuditIssues(issData.issues);
        if (lgData) setLinkGraph(lgData);
        if (dupData?.duplicates) setDuplicates(dupData.duplicates);
        if (utmData?.utm_campaigns) setUtmCampaigns(utmData.utm_campaigns);
        if (robData?.robots_history) setRobotsHistory(robData.robots_history);
        if (logData?.audit_logs) setAuditLogs(logData.audit_logs);
        if (gsc) setGscData(gsc);
        if (ga4) setGa4Data(ga4);
      })
      .catch((err) => {
        console.error("[SEO Panel Error]", err);
        setError(err.message || "Failed to load SEO platform data");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Actions
  const handleSaveGlobalSeo = async () => {
    setSubmitting(true);
    setSuccessMsg(null);
    await apiClient.updateAdminSeoConfig({
      meta_title: metaTitle,
      meta_description: metaDesc,
      keywords,
      canonical_url: canonicalUrl,
      og_image: ogImage,
      ga_id: gaId,
      fb_pixel_id: fbPixelId,
      gtm_id: gtmId,
      robots_txt: robotsTxt,
      schema_type: schemaType,
    });
    setSuccessMsg("Global SEO & Analytics Pixels Settings Saved!");
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSyncPages = async () => {
    setSubmitting(true);
    await apiClient.syncSeoPages();
    const pData = await apiClient.getSeoPages();
    if (pData?.pages) setPages(pData.pages);
    const sData = await apiClient.getSeoDashboardSummary();
    if (sData) setSummary(sData);
    setSuccessMsg("Synced Products, Categories, Branches & Pages into SEO Manager!");
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleAutoFix = async (issueId: string) => {
    setSubmitting(true);
    const res = await apiClient.autoFixSeoIssue(issueId);
    if (res?.fixed) {
      setSuccessMsg(res.message);
      const issData = await apiClient.getSeoAuditIssues();
      if (issData?.issues) setAuditIssues(issData.issues);
      const pData = await apiClient.getSeoPages();
      if (pData?.pages) setPages(pData.pages);
    } else {
      setError(res?.message || "Could not auto-fix issue");
    }
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleRunLiveCrawl = async () => {
    setSubmitting(true);
    const res = await apiClient.runLiveCrawler();
    setCrawlResults(res);
    setSubmitting(false);
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKw.keyword) return;
    setSubmitting(true);
    await apiClient.createSeoKeyword(newKw);
    setNewKw({ keyword: "", search_volume: 1000, difficulty: 30, target_url: "" });
    const kwData = await apiClient.getSeoKeywords();
    if (kwData?.keywords) setKeywordsList(kwData.keywords);
    setSubmitting(false);
  };

  const handleAddRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRedirect.source_url) return;
    setSubmitting(true);
    try {
      await apiClient.createSeoRedirect(newRedirect);
      setNewRedirect({ source_url: "", target_url: "", status_code: 301 });
      const rData = await apiClient.getSeoRedirects();
      if (rData?.redirects) setRedirectsList(rData.redirects);
      const val = await apiClient.validateSeoRedirects();
      if (val?.validation) setRedirectValidation(val.validation);
      setSuccessMsg("Redirect Rule Added!");
    } catch (err: any) {
      setError(err.message || "Failed to add redirect rule");
    } finally {
      setSubmitting(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleGenerateGeo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await apiClient.generateGeoLandingPage(newGeo);
    setNewGeo({ city: "Kollam", area: "", page_type: "city" });
    const gData = await apiClient.getSeoGeoPages();
    if (gData?.geo_pages) setGeoPages(gData.geo_pages);
    setSubmitting(false);
  };

  const handleAddAeo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAeo.question || !newAeo.answer) return;
    setSubmitting(true);
    await apiClient.createSeoAeoEntry(newAeo);
    setNewAeo({ question: "", answer: "", entry_type: "faq" });
    const aData = await apiClient.getSeoAeoEntries();
    if (aData?.aeo_entries) setAeoEntries(aData.aeo_entries);
    setSubmitting(false);
  };

  const handleValidateJsonLd = async () => {
    const res = await apiClient.validateJsonLd(jsonLdInput);
    setJsonLdValidation(res);
  };

  const handleValidateRobots = async () => {
    const res = await apiClient.validateRobotsSyntax(robotsTxt);
    setRobotsSyntax(res);
  };

  const handleValidateSitemap = async () => {
    const res = await apiClient.validateSitemapXml();
    setSitemapSyntax(res);
  };

  const handleBingSubmit = async () => {
    setSubmitting(true);
    const res = await apiClient.submitBingUrl(bingUrlInput);
    setSuccessMsg(res?.submitted ? "Submitted URL to Bing Webmaster API!" : res?.message || "Bing submission failed");
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleIndexingPublish = async () => {
    setSubmitting(true);
    const res = await apiClient.publishGoogleIndexingUrl(indexingUrlInput, "URL_UPDATED");
    setSuccessMsg(`Published URL notification to Google Indexing API (${res?.url})`);
    setSubmitting(false);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleGenerateAi = async (type: string) => {
    setSubmitting(true);
    const res = await apiClient.generateAiSeoContent(type, aiContext);
    setAiSuggestions(res?.suggestions || []);
    setSubmitting(false);
  };

  const generatedUtmLink = `${utmUrl}?utm_source=${encodeURIComponent(utmSource)}&utm_medium=${encodeURIComponent(utmMedium)}&utm_campaign=${encodeURIComponent(utmCampaign)}`;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Heading level="h2" className="text-xl">Enterprise SEO, GEO & AEO Platform</Heading>
        <FormSkeleton fields={8} />
      </div>
    );
  }

  const filteredPages = pages.filter((p) => {
    if (pageEntityType !== "all" && p.entity_type !== pageEntityType) return false;
    if (pageSearch) {
      const q = pageSearch.toLowerCase();
      return (p.slug || "").toLowerCase().includes(q) || (p.meta_title || "").toLowerCase().includes(q) || (p.url || "").toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Top Bar Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Heading level="h2" className="text-xl">Enterprise SEO, GEO & AEO Platform</Heading>
            <Badge color="green" className="text-xs">Production Grade</Badge>
          </div>
          <Text className="text-ui-fg-subtle text-sm">
            Search Engine Optimization, AI Generative Engine Optimization, Voice Answer Optimization & Local Landing Pages.
          </Text>
        </div>

        <div className="flex items-center gap-2">
          {/* RBAC Role Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-md text-xs">
            <Users className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={userRole}
              onChange={(e) => setUserRole(e.target.value)}
              className="bg-transparent border-0 font-semibold text-xs text-emerald-700 dark:text-emerald-400 focus:ring-0 cursor-pointer"
            >
              <option value="super_admin">Role: Super Admin</option>
              <option value="seo_manager">Role: SEO Manager</option>
              <option value="content_manager">Role: Content Manager</option>
              <option value="marketing_manager">Role: Marketing Manager</option>
              <option value="branch_manager">Role: Branch Manager</option>
            </select>
          </div>

          <Button size="small" variant="secondary" onClick={fetchAllData} className="flex items-center gap-1.5 text-xs">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="small" onClick={handleSyncPages} isLoading={submitting} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs">
            <Layers className="w-3.5 h-3.5" /> Sync Pages
          </Button>
          <Button onClick={handleSaveGlobalSeo} isLoading={submitting} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
            <Save className="w-3.5 h-3.5" /> Save Global Settings
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <Button size="small" variant="secondary" onClick={fetchAllData}>Retry</Button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 text-emerald-800 dark:text-emerald-200 text-xs rounded flex items-center justify-between">
          <span>✓ {successMsg}</span>
        </div>
      )}

      {/* Sub-Tabs Bar */}
      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-ui-border-base">
        {SEO_SUB_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-ui-bg-base text-ui-fg-base border border-b-0 border-ui-border-base shadow-sm font-semibold text-emerald-600"
                  : "text-ui-fg-subtle hover:text-ui-fg-base hover:bg-ui-bg-base-hover"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ── TAB 1: OVERVIEW & KPIS ────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-emerald-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">SEO Score</Text>
              <Text className="text-xl font-bold text-emerald-600">{summary?.seo_score || 0}<span className="text-xs text-ui-fg-subtle font-normal"> /100</span></Text>
              <Text className="text-[10px] text-ui-fg-subtle">On-page technical health</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-blue-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">GEO Score</Text>
              <Text className="text-xl font-bold text-blue-600">{summary?.geo_score || 0}<span className="text-xs text-ui-fg-subtle font-normal"> /100</span></Text>
              <Text className="text-[10px] text-ui-fg-subtle">ChatGPT/Gemini visibility</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-purple-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">AEO Score</Text>
              <Text className="text-xl font-bold text-purple-600">{summary?.aeo_score || 0}<span className="text-xs text-ui-fg-subtle font-normal"> /100</span></Text>
              <Text className="text-[10px] text-ui-fg-subtle">Voice & answer engines</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-amber-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">Indexed Pages</Text>
              <Text className="text-xl font-bold text-amber-600">{summary?.indexed_pages || 0}</Text>
              <Text className="text-[10px] text-ui-fg-subtle">Out of {summary?.total_pages || 0} total pages</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-rose-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">Broken Links</Text>
              <Text className="text-xl font-bold text-rose-600">{summary?.broken_links || 0}</Text>
              <Text className="text-[10px] text-ui-fg-subtle">Requires 301 redirect</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-indigo-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">Missing ALT</Text>
              <Text className="text-xl font-bold text-indigo-600">{summary?.missing_alt || 0}</Text>
              <Text className="text-[10px] text-ui-fg-subtle">Product images without alt</Text>
            </Container>

            <Container className="p-3.5 flex flex-col gap-1 border-l-4 border-l-cyan-500">
              <Text className="text-[11px] text-ui-fg-muted uppercase tracking-wider font-semibold">Tracked Keywords</Text>
              <Text className="text-xl font-bold text-cyan-600">{summary?.tracked_keywords || 0}</Text>
              <Text className="text-[10px] text-ui-fg-subtle">{summary?.total_redirects || 0} active redirects</Text>
            </Container>
          </div>

          <Container className="p-6 flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b pb-3">
              <Search className="w-5 h-5 text-blue-600" />
              <Text className="font-semibold text-base">Global Store Meta Tags & Social Sharing</Text>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="meta_title">Meta Title Tag</Label>
                  <span className={`text-[11px] ${metaTitle.length > 60 ? "text-rose-500 font-bold" : "text-ui-fg-subtle"}`}>
                    {metaTitle.length} / 60 chars
                  </span>
                </div>
                <Input id="meta_title" value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="CakeToHome — Premium Gourmet Cakes Delivered in 2 Hours" />
              </div>

              <div>
                <Label htmlFor="canonical">Canonical Base URL</Label>
                <Input id="canonical" value={canonicalUrl} onChange={(e) => setCanonicalUrl(e.target.value)} placeholder="https://cakes2home.com" />
              </div>

              <div className="md:col-span-2">
                <div className="flex justify-between items-center mb-1">
                  <Label htmlFor="meta_desc">Meta Description</Label>
                  <span className={`text-[11px] ${metaDesc.length > 160 ? "text-rose-500 font-bold" : "text-ui-fg-subtle"}`}>
                    {metaDesc.length} / 160 chars
                  </span>
                </div>
                <Textarea id="meta_desc" rows={2} value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} placeholder="Order handcrafted artisanal cakes online in Bangalore. Midnight delivery, customized birthday cakes, and same-day fresh delivery." />
              </div>

              <div>
                <Label htmlFor="keywords">Target Keywords (Comma Separated)</Label>
                <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} placeholder="cakes online, birthday cake delivery, midnight cake" />
              </div>

              <div>
                <Label htmlFor="og_image">Social Sharing Image URL (OpenGraph)</Label>
                <Input id="og_image" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://cakes2home.com/og-banner.jpg" />
              </div>
            </div>

            {/* SERP Live Preview */}
            <div className="mt-2 p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg flex flex-col gap-1">
              <Text className="text-xs font-semibold text-ui-fg-subtle uppercase tracking-wider mb-1">Google SERP Live Preview</Text>
              <Text className="text-xs text-emerald-700 dark:text-emerald-400 font-mono truncate">{canonicalUrl || "https://cakes2home.com"}</Text>
              <Text className="text-sm font-semibold text-blue-700 dark:text-blue-400 line-clamp-1">{metaTitle || "CakeToHome — Premium Gourmet Cakes Delivered in 2 Hours"}</Text>
              <Text className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{metaDesc || "Order handcrafted artisanal cakes online in Bangalore. Midnight delivery, customized birthday cakes, and same-day fresh delivery."}</Text>
            </div>
          </Container>
        </div>
      )}

      {/* ── TAB 2: PAGE SEO MANAGER ────────────────────────────────────────── */}
      {activeTab === "pages" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Per-Page SEO Manager</Text>
              <Text className="text-xs text-ui-fg-subtle">Configure custom meta tags, slugs, canonical URLs, and schema markup for every product, category, branch, city, and CMS page.</Text>
            </div>
            <Button size="small" variant="secondary" onClick={handleSyncPages} isLoading={submitting} className="text-xs">
              <RefreshCw className="w-3.5 h-3.5 mr-1" /> Re-sync Pages
            </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            <Input placeholder="Search by slug, meta title, or URL..." value={pageSearch} onChange={(e) => setPageSearch(e.target.value)} className="max-w-md" />
            <div className="flex gap-2">
              {["all", "product", "category", "branch", "city", "cms", "blog"].map((type) => (
                <button key={type} onClick={() => setPageEntityType(type)} className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors ${pageEntityType === type ? "bg-emerald-600 text-white font-semibold" : "bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200"}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>

          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Type</Table.HeaderCell>
                <Table.HeaderCell>Page Slug & URL</Table.HeaderCell>
                <Table.HeaderCell>Meta Title</Table.HeaderCell>
                <Table.HeaderCell>SEO Score</Table.HeaderCell>
                <Table.HeaderCell>GEO Score</Table.HeaderCell>
                <Table.HeaderCell>AEO Score</Table.HeaderCell>
                <Table.HeaderCell>Status</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {filteredPages.map((p) => (
                <Table.Row key={p.id}>
                  <Table.Cell><Badge color="blue" className="capitalize text-[10px]">{p.entity_type}</Badge></Table.Cell>
                  <Table.Cell className="font-mono text-xs text-emerald-600">{p.url || `/${p.slug}`}</Table.Cell>
                  <Table.Cell className="text-xs truncate max-w-[200px]">{p.meta_title || <span className="text-rose-500 font-semibold">Missing Title</span>}</Table.Cell>
                  <Table.Cell><span className={`text-xs font-bold ${p.seo_score >= 70 ? "text-emerald-600" : p.seo_score >= 40 ? "text-amber-600" : "text-rose-500"}`}>{p.seo_score || 0}%</span></Table.Cell>
                  <Table.Cell><span className="text-xs font-bold text-blue-600">{p.geo_score || 0}%</span></Table.Cell>
                  <Table.Cell><span className="text-xs font-bold text-purple-600">{p.aeo_score || 0}%</span></Table.Cell>
                  <Table.Cell><Badge color={p.status === "published" ? "green" : "grey"} className="text-[10px]">{p.status}</Badge></Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </Container>
      )}

      {/* ── TAB 8: AUDITS & ONE-CLICK AUTO-FIX ──────────────────────────────── */}
      {activeTab === "audits" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Comprehensive Technical SEO Audits & One-Click Auto-Fix</Text>
              <Text className="text-xs text-ui-fg-subtle">Classified issues sorted by severity priority. Use One-Click Auto-Fix to remediate missing titles, descriptions, and ALT text.</Text>
            </div>
            <Badge color="red" className="text-xs">{auditIssues.length} Active Issues</Badge>
          </div>

          {auditIssues.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-xs text-emerald-600 font-semibold">
              ✓ Clean Health! No technical SEO issues detected.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {auditIssues.map((iss) => (
                <div key={iss.id} className="p-4 border rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white dark:bg-slate-950">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge color={iss.severity === "critical" ? "red" : "orange"} className="text-[10px] uppercase font-bold">{iss.severity}</Badge>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{iss.title}</span>
                      <span className="text-[10px] font-mono text-ui-fg-subtle">Priority Score: {iss.priority}/100</span>
                    </div>
                    <Text className="text-xs text-slate-600 dark:text-slate-400">{iss.description}</Text>
                    <Text className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">💡 Fix Recommendation: {iss.recommendation}</Text>
                  </div>

                  {iss.auto_fixable && (
                    <Button size="small" onClick={() => handleAutoFix(iss.id)} isLoading={submitting} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs whitespace-nowrap">
                      <Wrench className="w-3.5 h-3.5 mr-1" /> One-Click Auto-Fix
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Container>
      )}

      {/* ── TAB 9: LIVE HTTP CRAWLER ────────────────────────────────────────── */}
      {activeTab === "crawler" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Live HTTP Crawler & DOM Inspector</Text>
              <Text className="text-xs text-ui-fg-subtle">Executes real HTTP requests against live website endpoints to inspect HTML titles, canonical links, and status codes.</Text>
            </div>
            <Button size="small" onClick={handleRunLiveCrawl} isLoading={submitting} className="bg-blue-600 hover:bg-blue-700 text-white text-xs flex items-center gap-1">
              <Play className="w-3.5 h-3.5" /> Execute Live HTTP Crawl
            </Button>
          </div>

          {crawlResults ? (
            <div className="flex flex-col gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg flex gap-4 text-xs font-mono">
                <span>Pages Scanned: <strong>{crawlResults.pagesCrawled?.length || 0}</strong></span>
                <span>Broken Links: <strong className="text-rose-600">{crawlResults.brokenLinks?.length || 0}</strong></span>
                <span>Orphan Pages: <strong className="text-amber-600">{crawlResults.orphanPages?.length || 0}</strong></span>
              </div>

              <Table>
                <Table.Header>
                  <Table.Row>
                    <Table.HeaderCell>Status</Table.HeaderCell>
                    <Table.HeaderCell>Crawled URL</Table.HeaderCell>
                    <Table.HeaderCell>HTML Title</Table.HeaderCell>
                    <Table.HeaderCell>H1 Heading</Table.HeaderCell>
                    <Table.HeaderCell>Issues Found</Table.HeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {crawlResults.pagesCrawled?.map((p: any, idx: number) => (
                    <Table.Row key={idx}>
                      <Table.Cell><Badge color={p.statusCode === 200 ? "green" : "red"} className="text-xs font-bold">{p.statusCode}</Badge></Table.Cell>
                      <Table.Cell className="font-mono text-xs text-blue-600">{p.url}</Table.Cell>
                      <Table.Cell className="text-xs truncate max-w-[180px]">{p.title || "—"}</Table.Cell>
                      <Table.Cell className="text-xs truncate max-w-[150px]">{p.h1Text || "—"}</Table.Cell>
                      <Table.Cell><span className="text-xs text-rose-600 font-semibold">{p.issues?.length || 0} issues</span></Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed rounded-lg text-ui-fg-subtle text-xs">
              Click "Execute Live HTTP Crawl" above to initiate a real-time HTTP scanner against active website pages.
            </div>
          )}
        </Container>
      )}

      {/* ── TAB 10: INTERNAL LINK GRAPH ─────────────────────────────────────── */}
      {activeTab === "links" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Internal Link Graph & PageRank Topology</Text>
              <Text className="text-xs text-ui-fg-subtle">Classify pages by inbound links: Orphan (0 inlinks), Weak (1 inlink), Optimal (2-5 inlinks), Authority Hub (6+ inlinks).</Text>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="p-4 bg-rose-50 dark:bg-rose-950 border border-rose-200 rounded-lg">
              <Text className="text-xs text-rose-800 font-semibold">Orphan Pages</Text>
              <Text className="text-2xl font-bold text-rose-600 mt-1">{linkGraph?.orphanCount || 0}</Text>
              <Text className="text-[10px] text-rose-700">0 inbound internal links</Text>
            </div>
            <div className="p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 rounded-lg">
              <Text className="text-xs text-amber-800 font-semibold">Weak Pages</Text>
              <Text className="text-2xl font-bold text-amber-600 mt-1">{linkGraph?.weakCount || 0}</Text>
              <Text className="text-[10px] text-amber-700">1 inbound internal link</Text>
            </div>
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 rounded-lg">
              <Text className="text-xs text-emerald-800 font-semibold">Optimal Pages</Text>
              <Text className="text-2xl font-bold text-emerald-600 mt-1">{linkGraph?.metrics?.filter((m: any) => m.classification === "optimal").length || 0}</Text>
              <Text className="text-[10px] text-emerald-700">2-5 inbound internal links</Text>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-950 border border-purple-200 rounded-lg">
              <Text className="text-xs text-purple-800 font-semibold">Authority Hubs</Text>
              <Text className="text-2xl font-bold text-purple-600 mt-1">{linkGraph?.authorityCount || 0}</Text>
              <Text className="text-[10px] text-purple-700">6+ inbound internal links</Text>
            </div>
          </div>
        </Container>
      )}

      {/* ── TAB 12: INTEGRATIONS & APIS ────────────────────────────────────── */}
      {activeTab === "integrations" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Third-Party Search Integrations & Webmaster APIs</Text>
              <Text className="text-xs text-ui-fg-subtle">Connect Google Search Console, GA4 Data API, Bing Webmaster API, and Google Instant Indexing API.</Text>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg flex flex-col gap-3">
              <Text className="font-semibold text-xs text-blue-600 flex items-center gap-1.5">
                <Globe className="w-4 h-4" /> Bing Webmaster URL Submission API
              </Text>
              <Input value={bingUrlInput} onChange={(e) => setBingUrlInput(e.target.value)} placeholder="URL to submit to Bing Index" />
              <Button size="small" onClick={handleBingSubmit} isLoading={submitting} className="bg-blue-600 text-white text-xs">
                Submit URL to Bing API
              </Button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border rounded-lg flex flex-col gap-3">
              <Text className="font-semibold text-xs text-emerald-600 flex items-center gap-1.5">
                <Zap className="w-4 h-4" /> Google Instant Indexing API
              </Text>
              <Input value={indexingUrlInput} onChange={(e) => setIndexingUrlInput(e.target.value)} placeholder="URL to notify Google Indexing API" />
              <Button size="small" onClick={handleIndexingPublish} isLoading={submitting} className="bg-emerald-600 text-white text-xs">
                Publish URL Notification
              </Button>
            </div>
          </div>
        </Container>
      )}

      {/* ── TAB 16: IMMUTABLE AUDIT LOGS ───────────────────────────────────── */}
      {activeTab === "audit_logs" && (
        <Container className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div>
              <Text className="font-semibold text-base">Immutable SEO Audit Trail with State Diffs</Text>
              <Text className="text-xs text-ui-fg-subtle">Tracks who modified metadata, generated GEO pages, or executed auto-fixes with exact before/after state diffs.</Text>
            </div>
          </div>

          {auditLogs.length === 0 ? (
            <div className="p-8 text-center border border-dashed rounded-lg text-ui-fg-subtle text-xs">
              No audit log entries recorded yet.
            </div>
          ) : (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.HeaderCell>Timestamp</Table.HeaderCell>
                  <Table.HeaderCell>Action</Table.HeaderCell>
                  <Table.HeaderCell>Entity</Table.HeaderCell>
                  <Table.HeaderCell>User & Role</Table.HeaderCell>
                  <Table.HeaderCell>Diff Summary</Table.HeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {auditLogs.map((l) => (
                  <Table.Row key={l.id}>
                    <Table.Cell className="font-mono text-[11px] text-ui-fg-subtle">{l.timestamp || l.created_at}</Table.Cell>
                    <Table.Cell><Badge color="purple" className="text-[10px] uppercase font-bold">{l.action}</Badge></Table.Cell>
                    <Table.Cell className="font-mono text-xs">{l.entity_type} ({l.entity_id || "—"})</Table.Cell>
                    <Table.Cell className="text-xs">{l.user} ({l.user_role || "admin"})</Table.Cell>
                    <Table.Cell className="text-xs font-mono text-emerald-600 max-w-[250px] truncate">{l.diff_summary || l.details || "—"}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}
        </Container>
      )}
    </div>
  );
});
