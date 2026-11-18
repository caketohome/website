"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import {
  Container, Heading, Text, Badge, Button, Input, Label, Textarea, Select,
} from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  FileText, Plus, Copy, Trash2, Eye, Save, RotateCcw, Clock, CheckCircle2,
  Globe, Layers, Share2, BarChart3, Bell, Lock, UserCheck, MapPin,
  Smartphone, FormInput, Sparkles, ChevronDown, ChevronUp, Settings,
  Image as ImageIcon, ArrowUp, ArrowDown, XCircle, AlertCircle, Check,
  Search, Tag, Monitor, ExternalLink, Send, EyeOff, ShieldCheck, Megaphone,
  List, Sliders, PenLine, Tablet, Upload, Undo2, Redo2, Palette, Box, CheckSquare,
  GripVertical, Gift, Zap, X, RefreshCw
} from "lucide-react";
import { MediaSelectorModal, MediaSelection } from "./media-selector-modal";
import { PageRenderer } from "@frontend/components/store/cms/page-renderer";
import { PromotionalBannerEditor } from "./promotional-banner-editor";
import { AnnouncementBarEditor } from "./announcement-bar-editor";
import { SectionConfigEditor } from "./section-config-editor";
import { PdpBuilderEditor } from "./pdp-builder-editor";
import {
  SECTION_REGISTRY, SECTION_CATEGORIES, getSectionDefinition, searchSections, getDefaultConfig,
  type SectionCategory, type SectionTypeDefinition,
} from "@frontend/lib/cms/section-registry";

// ── Types ──────────────────────────────────────────────────────────────────
type DeviceMode = "desktop" | "tablet" | "mobile" | "full";
type PageTab = "general" | "pdp" | "login" | "seo" | "theme" | "visibility" | "marketing" | "advanced" | "publish";
type MobilePanelTab = "settings" | "preview" | "sections";

// SECTION_TYPES is now sourced from the central section registry
// (see @frontend/lib/cms/section-registry.ts)
const SECTION_TYPES = SECTION_REGISTRY;

const PRODUCT_MODES = [
  { value: "best_sellers", label: "Best Sellers" },
  { value: "new_arrivals", label: "New Arrivals" },
  { value: "featured", label: "Featured" },
  { value: "all", label: "All Products" },
  { value: "manual", label: "Manual Selection" },
];

const PAGE_TYPES = [
  { value: "home", label: "Homepage" },
  { value: "catalog", label: "Product Catalog" },
  { value: "product", label: "Product Detail Page (PDP)" },
  { value: "landing", label: "Landing Page" },
  { value: "campaign", label: "Campaign Page" },
  { value: "page", label: "Static Page" },
  { value: "blog", label: "Blog" },
  { value: "legal", label: "Legal Page" },
  { value: "faq", label: "FAQ Page" },
];

const ROBOTS_OPTIONS = [
  "index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow",
];

const STRUCTURED_DATA_TYPES = [
  "WebPage", "FAQPage", "Product", "Organization", "CollectionPage",
  "ContactPage", "Article", "BreadcrumbList", "LocalBusiness",
];

function calcSeoScore(page: any): { score: number; label: string; color: string } {
  let score = 0;
  if (page.meta_title && page.meta_title.length >= 10 && page.meta_title.length <= 60) score += 20;
  else if (page.meta_title) score += 10;
  if (page.meta_description && page.meta_description.length >= 30 && page.meta_description.length <= 160) score += 20;
  else if (page.meta_description) score += 10;
  if (page.keywords && page.keywords.trim().length > 0) score += 10;
  if (page.canonical_url && page.canonical_url.startsWith("https://")) score += 10;
  if (page.og_title && page.og_description && page.og_image) score += 15;
  if (page.structured_data_type && page.structured_data_type !== "WebPage") score += 10;
  if (page.sitemap_include) score += 5;
  if (page.robots_tag === "index, follow") score += 10;
  const label = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Fair" : "Poor";
  const color = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-blue-600" : score >= 40 ? "text-brand-gold" : "text-red-600";
  return { score, label, color };
}

function blankPage(): any {
  return {
    title: "",
    slug: "",
    page_type: "landing",
    template: "default",
    status: "draft",
    url_path: "",
    breadcrumb_title: "",
    h1: "",
    subheading: "",
    intro_content: "",
    meta_title: "",
    meta_description: "",
    robots_tag: "index, follow",
    canonical_url: "",
    keywords: "",
    og_title: "",
    og_description: "",
    og_image: "",
    og_type: "website",
    twitter_card: "summary_large_image",
    twitter_title: "",
    twitter_description: "",
    twitter_image: "",
    structured_data_type: "WebPage",
    sitemap_include: true,
    sitemap_priority: "0.7",
    sitemap_changefreq: "weekly",
    nav_location: "none",
    hide_from_nav: false,
    visibility_rules: { audience: "public", devices: "all", locations: "all" },
    announcement_bar: { enabled: false, text: "", cta_text: "", cta_url: "", bg_color: "#1D2F5D" },
    theme: { bg_color: "#FFFCF8", text_color: "#152347", heading_color: "#1D2F5D", accent_color: "#C28A2C" },
    header_config: { show_header: true, style: "default" },
    sections: [],
    draft_config: { sections: [], banners: [], products_mode: "best_sellers", product_ids: [], category_ids: [] },
    published_config: null,
    version_history: [],
  };
}

function Field({ label, hint, children }: { label: string | React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-brand-navy" : "bg-ui-bg-component border border-ui-border-base"}`}
      aria-label={label}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${checked ? "translate-x-4" : "translate-x-0.5"}`} />
    </button>
  );
}

function SectionIcon({ type }: { type: string }) {
  const sec = getSectionDefinition(type);
  return <span className="text-sm">{sec?.icon || "📄"}</span>;
}

export function PageConfigurator() {
  const [pages, setPages] = useState<any[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string>("cmspg_home");
  const [editingPage, setEditingPage] = useState<any>(blankPage());
  const [savedSnapshot, setSavedSnapshot] = useState<string>("");

  // Editor Navigation & Layout State
  const [activeTab, setActiveTab] = useState<PageTab>("general");
  const [configuringSection, setConfiguringSection] = useState<string | null>(null);
  const [sectionConfigDevice, setSectionConfigDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [canvasDevice, setCanvasDevice] = useState<DeviceMode>("desktop");
  const [mobilePanelTab, setMobilePanelTab] = useState<MobilePanelTab>("preview");

  // DOM Scroll References
  const centerCanvasRef = useRef<HTMLDivElement>(null);

  // History & Undo / Redo
  const [undoStack, setUndoStack] = useState<any[]>([]);
  const [redoStack, setRedoStack] = useState<any[]>([]);

  // Loading & Toast State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Search & Modal State
  const [productSearch, setProductSearch] = useState("");
  const [newAreaInput, setNewAreaInput] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddSectionModal, setShowAddSectionModal] = useState(false);
  const [addSectionType, setAddSectionType] = useState<string>("hero");
  const [sectionSearchQuery, setSectionSearchQuery] = useState("");
  const [activeSectionCategory, setActiveSectionCategory] = useState<SectionCategory | "all">("all");
  const [newPageForm, setNewPageForm] = useState({ title: "", slug: "", page_type: "landing", status: "draft" });
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [sectionListFilter, setSectionListFilter] = useState("");

  // Related API Data
  const [allProducts, setAllProducts] = useState<any[]>([]);
  const [allCategories, setAllCategories] = useState<any[]>([]);
  const [allOccasions, setAllOccasions] = useState<any[]>([]);

  // Drag & Drop State
  const [draggedSectionIndex, setDraggedSectionIndex] = useState<number | null>(null);
  const [dragOverSectionIndex, setDragOverSectionIndex] = useState<number | null>(null);

  // Media Selector Modal Config
  const [mediaModalConfig, setMediaModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    currentValue?: { media_id?: string; url?: string; alt?: string };
    onSelect: (selection: MediaSelection) => void;
  }>({
    isOpen: false,
    title: "Select Image",
    onSelect: () => {},
  });

  const isDirty = useMemo(() => {
    return JSON.stringify(editingPage) !== savedSnapshot;
  }, [editingPage, savedSnapshot]);

  // Load All Pages & Data
  useEffect(() => {
    loadAll(undefined, true);
  }, []);

  const loadAll = async (targetPageId?: string, isInitial = false) => {
    if (isInitial || pages.length === 0) {
      setLoading(true);
    }
    try {
      const [pagesRes, productsRes, catsRes, occsRes] = await Promise.allSettled([
        apiClient.getCmsPages(),
        apiClient.getAdminProducts(),
        apiClient.getAdminCategories(),
        apiClient.getAdminOccasions(),
      ]);
      const fetchedPages = (pagesRes.status === "fulfilled" ? (pagesRes.value as any)?.pages : null) || [];
      if (fetchedPages.length > 0) {
        setPages(fetchedPages);
      }
      if (productsRes.status === "fulfilled" && (productsRes.value as any)?.products) {
        setAllProducts((productsRes.value as any).products);
      }
      if (catsRes.status === "fulfilled" && (catsRes.value as any)?.categories) {
        setAllCategories((catsRes.value as any).categories);
      }
      if (occsRes.status === "fulfilled" && (occsRes.value as any)?.occasions) {
        setAllOccasions((occsRes.value as any).occasions);
      }

      if (fetchedPages.length > 0) {
        const activeId = targetPageId || selectedPageId;
        const def = fetchedPages.find((p: any) => p.id === activeId) || fetchedPages.find((p: any) => p.id === selectedPageId) || fetchedPages[0];
        setSelectedPageId(def.id);
        setEditingPage(def);
        setSavedSnapshot(JSON.stringify(def));
        setUndoStack([]);
        setRedoStack([]);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedSectionIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSectionIndex !== index) {
      setDragOverSectionIndex(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSectionIndex === null || draggedSectionIndex === targetIndex) {
      setDraggedSectionIndex(null);
      setDragOverSectionIndex(null);
      return;
    }
    const secs = [...getSections()];
    const [draggedItem] = secs.splice(draggedSectionIndex, 1);
    secs.splice(targetIndex, 0, draggedItem);
    secs.forEach((s, i) => (s.order = i + 1));
    setSections(secs);
    setDraggedSectionIndex(null);
    setDragOverSectionIndex(null);

    // Save reordered sections to database atomically if page exists
    if (editingPage.id) {
      try {
        await apiClient.reorderCmsPageSections(editingPage.id, secs.map(s => s.id));
        showToast("Section order updated & saved!");
      } catch {
        // ignore
      }
    }
  };

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Canvas-Only Section Scrolling Helper
  const scrollToSectionInCanvas = (sectionId: string) => {
    setConfiguringSection(sectionId);
    setMobilePanelTab("settings");
    if (centerCanvasRef.current) {
      const targetEl = centerCanvasRef.current.querySelector(`[data-section-id="${sectionId}"]`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  // State Mutation with History Stack
  const pushState = (nextState: any) => {
    setUndoStack(prev => [...prev.slice(-49), editingPage]);
    setRedoStack([]);
    setEditingPage(nextState);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setRedoStack(r => [editingPage, ...r]);
    setUndoStack(u => u.slice(0, u.length - 1));
    setEditingPage(prev);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setUndoStack(u => [...u, editingPage]);
    setRedoStack(r => r.slice(1));
    setEditingPage(next);
  };

  // Keyboard Shortcuts for Undo / Redo / Save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSaveDraft();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingPage, undoStack, redoStack]);

  const updateField = (key: string, value: any) => {
    pushState({ ...editingPage, [key]: value });
  };

  const updateNestedField = (parent: string, key: string, value: any) => {
    pushState({
      ...editingPage,
      [parent]: { ...(editingPage[parent] || {}), [key]: value },
    });
  };

  const getSections = () => editingPage.sections || [];

  const setSections = (secs: any[]) => {
    updateField("sections", secs);
  };

  const updateSectionField = (id: string, key: string, value: any) => {
    const updated = getSections().map((s: any) => s.id === id ? { ...s, [key]: value } : s);
    setSections(updated);
  };

  const updateSectionConfig = (id: string, configKey: string, value: any) => {
    const updated = getSections().map((s: any) =>
      s.id === id ? { ...s, config: { ...(s.config || {}), [configKey]: value } } : s
    );
    setSections(updated);
  };

  const updateSectionWholeConfig = (id: string, newConfig: any) => {
    const updated = getSections().map((s: any) =>
      s.id === id ? { ...s, config: { ...(s.config || {}), ...newConfig } } : s
    );
    setSections(updated);
  };

  const updateSectionNestedConfig = (id: string, device: "desktop" | "tablet" | "mobile", configKey: string, value: any) => {
    const updated = getSections().map((s: any) => {
      if (s.id !== id) return s;
      const curConfig = s.config || {};
      const deviceObj = curConfig[device] || {};
      return {
        ...s,
        config: {
          ...curConfig,
          [device]: {
            ...deviceObj,
            [configKey]: value,
          },
        },
      };
    });
    setSections(updated);
  };

  const addSection = (typeOverride?: string) => {
    const sType = typeOverride || addSectionType;
    const sectionDef = getSectionDefinition(sType);
    const newSec = {
      id: `sec_${Date.now()}`,
      type: sType,
      name: sectionDef?.label || "New Section",
      enabled: true,
      order: getSections().length + 1,
      config: sectionDef ? { ...sectionDef.defaultConfig } : {},
    };
    setSections([...getSections(), newSec]);
    setShowAddSectionModal(false);
    setSectionSearchQuery("");
    setActiveSectionCategory("all");
    scrollToSectionInCanvas(newSec.id);
    showToast(`Added ${sectionDef?.label || sType} section`);
  };

  const duplicateSection = (id: string) => {
    const secs = getSections();
    const targetIdx = secs.findIndex((s: any) => s.id === id);
    if (targetIdx < 0) return;
    const targetSec = secs[targetIdx];
    const cloned = JSON.parse(JSON.stringify(targetSec));
    cloned.id = `sec_${Date.now()}`;
    cloned.name = `${cloned.name} (Copy)`;
    cloned.order = targetIdx + 2;
    const nextSecs = [...secs];
    nextSecs.splice(targetIdx + 1, 0, cloned);
    nextSecs.forEach((s, i) => (s.order = i + 1));
    setSections(nextSecs);
    scrollToSectionInCanvas(cloned.id);
    showToast(`Duplicated ${targetSec.name}`);
  };

  const removeSection = (id: string) => {
    if (!confirm("Remove this section?")) return;
    setSections(getSections().filter((s: any) => s.id !== id));
    if (configuringSection === id) setConfiguringSection(null);
  };

  const moveSectionUp = (idx: number) => {
    if (idx === 0) return;
    const secs = [...getSections()];
    [secs[idx - 1], secs[idx]] = [secs[idx], secs[idx - 1]];
    secs.forEach((s, i) => (s.order = i + 1));
    setSections(secs);
  };

  const moveSectionDown = (idx: number) => {
    const secs = getSections();
    if (idx === secs.length - 1) return;
    const copy = [...secs];
    [copy[idx + 1], copy[idx]] = [copy[idx], copy[idx + 1]];
    copy.forEach((s, i) => (s.order = i + 1));
    setSections(copy);
  };

  const toggleSection = (id: string) => {
    setSections(getSections().map((s: any) => s.id === id ? { ...s, enabled: !s.enabled } : s));
  };

  const moveArrayItem = (arr: any[], fromIdx: number, toIdx: number) => {
    if (toIdx < 0 || toIdx >= arr.length) return arr;
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  };

  const openImagePicker = (
    title: string,
    currentValue: { media_id?: string; url?: string; alt?: string } | undefined,
    onSelect: (selection: MediaSelection) => void
  ) => {
    setMediaModalConfig({
      isOpen: true,
      title,
      currentValue,
      onSelect,
    });
  };

  const handleSelectPage = (pageId: string) => {
    if (isDirty && !confirm("You have unsaved changes. Switch page anyway?")) return;
    setSelectedPageId(pageId);
    const pg = pages.find((p) => p.id === pageId);
    if (pg) {
      setEditingPage(pg);
      setSavedSnapshot(JSON.stringify(pg));
      setConfiguringSection(null);
      setUndoStack([]);
      setRedoStack([]);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      let res: any;
      if (editingPage.id) {
        res = await apiClient.updateCmsPage(editingPage.id, editingPage);
      } else {
        res = await apiClient.createCmsPage(editingPage);
      }
      const updated = res?.page || res;
      if (updated?.id) {
        setEditingPage(updated);
        setPages((prev) => {
          const exists = prev.some((p) => p.id === updated.id);
          return exists ? prev.map((p) => (p.id === updated.id ? updated : p)) : [...prev, updated];
        });
        setSavedSnapshot(JSON.stringify(updated));
        setSelectedPageId(updated.id);
      }
      showToast("Draft saved successfully to PostgreSQL! 🎉");
      loadAll(updated?.id || editingPage.id, false);
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) {
        return;
      }
      if (err?.name === "TimeoutError" || err?.message?.includes("timed out")) {
        showToast("Save draft request timed out. Your changes are persisting in PostgreSQL; please refresh shortly.", "error");
        return;
      }
      showToast(err?.message || "Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    console.log("[handlePublish] CLICKED for page:", editingPage.id);
    try {
      if (editingPage.id) {
        console.log("[handlePublish] updating page draft first...");
        await apiClient.updateCmsPage(editingPage.id, editingPage);
        console.log("[handlePublish] update completed successfully.");
      }
      console.log("[handlePublish] calling publishCmsPage for:", editingPage.id);
      const res: any = await apiClient.publishCmsPage(editingPage.id);
      console.log("[handlePublish] publish response received:", res);
      if (res?.success === false || res?.errors?.length > 0) {
        const errs = res?.errors || ["Validation failed"];
        setValidationResult({ valid: false, errors: errs, warnings: res?.warnings || [] });
        setActiveTab("publish");
        setConfiguringSection(null);
        showToast("Fix validation errors before publishing", "error");
      } else {
        const published = res?.page || { ...editingPage, status: "published", published_at: new Date().toISOString() };
        setEditingPage(published);
        setPages((prev) => prev.map((p) => (p.id === published.id ? published : p)));
        setSavedSnapshot(JSON.stringify(published));
        setValidationResult(null);
        showToast("Page published successfully! Customer storefront updated in PostgreSQL. 🎉");
        loadAll(published.id, false);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) {
        return;
      }
      if (err?.name === "TimeoutError" || err?.message?.includes("timed out")) {
        showToast("Publish request timed out while writing to PostgreSQL. Please refresh shortly to verify status.", "error");
        return;
      }
      showToast(err?.message || "Failed to publish", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleRollback = async (version: number | string) => {
    if (!confirm(`Are you sure you want to rollback to revision #${version}? This will restore the layout and configuration from that version.`)) return;
    try {
      const res: any = await apiClient.rollbackCmsPage(editingPage.id, Number(version) || 1);
      const rolledBack = res?.page || res;
      if (rolledBack?.id) {
        setEditingPage(rolledBack);
        setPages((prev) => prev.map((p) => (p.id === rolledBack.id ? rolledBack : p)));
        setSavedSnapshot(JSON.stringify(rolledBack));
        setConfiguringSection(null);
        setShowVersionModal(false);
        showToast(`Rolled back to revision #${version} in PostgreSQL! 🎉`);
        loadAll(rolledBack.id, false);
      } else {
        showToast("Rollback did not return updated page data", "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to rollback revision", "error");
    }
  };

  const handleUnpublish = async () => {
    try {
      const res: any = await apiClient.unpublishCmsPage(editingPage.id);
      const unpublished = res?.page || { ...editingPage, status: "draft" };
      setEditingPage(unpublished);
      setPages((prev) => prev.map((p) => (p.id === unpublished.id ? unpublished : p)));
      setSavedSnapshot(JSON.stringify(unpublished));
      showToast("Page unpublished — set back to Draft in PostgreSQL");
      loadAll(editingPage.id, false);
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) return;
      showToast(err?.message || "Failed to unpublish", "error");
    }
  };

  const handleDuplicate = async () => {
    try {
      const res: any = await apiClient.duplicateCmsPage(editingPage.id);
      showToast(`Duplicated as "${res?.page?.title || "Copy"}"`);
      await loadAll();
      if (res?.page?.id) {
        setSelectedPageId(res.page.id);
        setEditingPage(res.page);
        setSavedSnapshot(JSON.stringify(res.page));
      }
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) return;
      showToast(err?.message || "Failed to duplicate", "error");
    }
  };

  const handleCreatePage = async () => {
    if (!newPageForm.title.trim()) return;
    const slugVal = newPageForm.slug || newPageForm.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      const res: any = await apiClient.createCmsPage({ ...newPageForm, slug: slugVal, url_path: `/${slugVal}` });
      showToast(`Created "${newPageForm.title}"`);
      setShowCreateModal(false);
      setNewPageForm({ title: "", slug: "", page_type: "landing", status: "draft" });
      await loadAll();
      if (res?.page?.id) {
        setSelectedPageId(res.page.id);
        setEditingPage(res.page);
        setSavedSnapshot(JSON.stringify(res.page));
      }
    } catch {
      showToast("Failed to create page", "error");
    }
  };

  const seoScore = calcSeoScore(editingPage);
  const selectedSection = getSections().find((s: any) => s.id === configuringSection);

  if (loading) {
    return (
      <div className="flex flex-col gap-4 animate-pulse">
        <div className="h-16 bg-ui-bg-subtle rounded-xl" />
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 h-[600px] bg-ui-bg-subtle rounded-xl" />
          <div className="col-span-7 h-[600px] bg-ui-bg-subtle rounded-xl" />
          <div className="col-span-2 h-[600px] bg-ui-bg-subtle rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Toast Notification */}
      {toastMsg && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-sm font-medium animate-in slide-in-from-bottom-4 duration-300 ${toastMsg.type === "error" ? "bg-red-600 text-white" : "bg-ui-bg-inverted text-ui-fg-on-inverted"}`}>
          {toastMsg.type === "error" ? <XCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toastMsg.text}
        </div>
      )}

      {/* Media Selector Modal */}
      <MediaSelectorModal
        isOpen={mediaModalConfig.isOpen}
        title={mediaModalConfig.title}
        currentValue={mediaModalConfig.currentValue}
        onClose={() => setMediaModalConfig(prev => ({ ...prev, isOpen: false }))}
        onSelect={(selection) => {
          mediaModalConfig.onSelect(selection);
          setMediaModalConfig(prev => ({ ...prev, isOpen: false }));
        }}
      />

      {/* Create Page Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-ui-bg-base rounded-2xl shadow-2xl p-6 w-full max-w-md flex flex-col gap-4 border border-ui-border-base">
            <div className="flex items-center justify-between">
              <Heading level="h3" className="text-base font-bold">Create New Page</Heading>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-ui-bg-subtle">
                <XCircle className="w-4 h-4 text-ui-fg-muted" />
              </button>
            </div>
            <Field label="Page Title">
              <Input
                value={newPageForm.title}
                onChange={e => {
                  const t = e.target.value;
                  setNewPageForm(prev => ({
                    ...prev,
                    title: t,
                    slug: prev.slug || t.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
                  }));
                }}
                placeholder="e.g. Birthday Cakes Collection"
                autoFocus
              />
            </Field>
            <Field label="URL Slug">
              <Input
                value={newPageForm.slug}
                onChange={e => setNewPageForm(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "") }))}
                placeholder="e.g. birthday-cakes"
              />
            </Field>
            <Field label="Page Type">
              <select
                value={newPageForm.page_type}
                onChange={e => setNewPageForm(prev => ({ ...prev, page_type: e.target.value }))}
                className="w-full py-2 px-3 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-850 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs cursor-pointer"
              >
                {PAGE_TYPES.map(t => (
                  <option key={t.value} value={t.value} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="flex gap-2 pt-2">
              <Button variant="secondary" size="small" onClick={() => setShowCreateModal(false)} className="flex-1">Cancel</Button>
              <Button variant="primary" size="small" onClick={handleCreatePage} className="flex-1" disabled={!newPageForm.title.trim()}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Create Page
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Add Section Modal — Categorized Section Browser */}
      {showAddSectionModal && (() => {
        const filteredSections = sectionSearchQuery.trim()
          ? searchSections(sectionSearchQuery)
          : activeSectionCategory === "all"
            ? SECTION_REGISTRY
            : SECTION_REGISTRY.filter(s => s.category === activeSectionCategory);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-ui-bg-base rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-ui-border-base overflow-hidden">
              {/* Header */}
              <div className="shrink-0 p-5 border-b border-ui-border-base flex items-center justify-between">
                <div>
                  <Heading level="h3" className="text-lg font-bold">Add Page Section</Heading>
                  <Text className="text-xs text-ui-fg-muted mt-0.5">{SECTION_REGISTRY.length} sections in {SECTION_CATEGORIES.length} categories</Text>
                </div>
                <button onClick={() => { setShowAddSectionModal(false); setSectionSearchQuery(""); setActiveSectionCategory("all"); }} className="p-1.5 rounded-lg hover:bg-ui-bg-subtle">
                  <XCircle className="w-5 h-5 text-ui-fg-muted" />
                </button>
              </div>

              {/* Search */}
              <div className="shrink-0 px-5 py-3 border-b border-ui-border-base">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ui-fg-muted" />
                  <input
                    type="text"
                    value={sectionSearchQuery}
                    onChange={e => { setSectionSearchQuery(e.target.value); if (e.target.value.trim()) setActiveSectionCategory("all"); }}
                    placeholder="Search sections... (e.g. product, hero, FAQ, delivery)"
                    className="w-full pl-9 pr-4 py-2 text-sm bg-ui-bg-subtle border border-ui-border-base rounded-xl outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                    autoFocus
                  />
                  {sectionSearchQuery && (
                    <button onClick={() => setSectionSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <XCircle className="w-4 h-4 text-ui-fg-muted hover:text-ui-fg-base" />
                    </button>
                  )}
                </div>
              </div>

              {/* Body: Categories sidebar + Section grid */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Category sidebar */}
                <div className="shrink-0 w-48 border-r border-ui-border-base overflow-y-auto bg-ui-bg-subtle/30 p-2 flex flex-col gap-0.5">
                  <button
                    onClick={() => { setActiveSectionCategory("all"); setSectionSearchQuery(""); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                      activeSectionCategory === "all" && !sectionSearchQuery
                        ? "bg-brand-navy text-white shadow-sm border border-brand-gold/40"
                        : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
                    }`}
                  >
                    📑 All Sections ({SECTION_REGISTRY.length})
                  </button>
                  {SECTION_CATEGORIES.map(cat => {
                    const count = SECTION_REGISTRY.filter(s => s.category === cat.id).length;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => { setActiveSectionCategory(cat.id); setSectionSearchQuery(""); }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-between ${
                          activeSectionCategory === cat.id && !sectionSearchQuery
                            ? "bg-brand-navy text-white shadow-sm border border-brand-gold/40"
                            : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
                        }`}
                      >
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{cat.icon}</span>
                          <span className="truncate">{cat.label}</span>
                        </span>
                        <span className={`text-[10px] font-bold shrink-0 ${
                          activeSectionCategory === cat.id && !sectionSearchQuery ? "text-white/80" : "text-ui-fg-subtle"
                        }`}>{count}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Section grid */}
                <div className="flex-1 overflow-y-auto p-4">
                  {filteredSections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-ui-fg-muted">
                      <Search className="w-8 h-8 mb-2 opacity-30" />
                      <Text className="text-sm font-semibold">No sections found</Text>
                      <Text className="text-xs">Try a different search term or category</Text>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                      {filteredSections.map(st => (
                        <button
                          key={st.value}
                          onClick={() => addSection(st.value)}
                          className="p-3 rounded-xl text-left flex items-start gap-3 transition-all border bg-ui-bg-subtle/30 border-ui-border-base hover:bg-brand-navy/5 hover:border-brand-navy/30 hover:shadow-sm dark:hover:bg-brand-navy/20 group"
                        >
                          <span className="text-xl shrink-0 mt-0.5">{st.icon}</span>
                          <div className="min-w-0">
                            <Text className="text-xs font-bold group-hover:text-brand-navy dark:group-hover:text-brand-gold truncate">{st.label}</Text>
                            <Text className="text-[10px] text-ui-fg-muted line-clamp-2 leading-relaxed mt-0.5">{st.description}</Text>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="shrink-0 p-4 border-t border-ui-border-base flex items-center justify-between bg-ui-bg-subtle/30">
                <Text className="text-xs text-ui-fg-muted">
                  {sectionSearchQuery ? `${filteredSections.length} results for "${sectionSearchQuery}"` : `${filteredSections.length} sections available`}
                </Text>
                <Button variant="secondary" size="small" onClick={() => { setShowAddSectionModal(false); setSectionSearchQuery(""); setActiveSectionCategory("all"); }}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* VERSION HISTORY & ROLLBACK MODAL */}
      {showVersionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-2xl w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-4 border-b border-ui-border-base flex items-center justify-between bg-ui-bg-subtle/40">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-brand-gold/10 text-brand-gold border border-brand-gold/30">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ui-fg-base">Revision History & Rollback</h3>
                  <p className="text-xs text-ui-fg-muted">Durable snapshots stored in PostgreSQL on every publish</p>
                </div>
              </div>
              <button
                onClick={() => setShowVersionModal(false)}
                className="p-1 rounded-lg text-ui-fg-muted hover:text-ui-fg-base hover:bg-ui-bg-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
              {(!editingPage.version_history || editingPage.version_history.length === 0) ? (
                <div className="text-center py-12 text-ui-fg-muted flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 opacity-30" />
                  <p className="text-xs font-semibold">No revision snapshots recorded yet.</p>
                  <p className="text-[11px] text-ui-fg-subtle">A new snapshot is automatically captured each time you publish this page.</p>
                </div>
              ) : (
                [...editingPage.version_history].reverse().map((entry: any, i: number) => {
                  const verNum = entry.version || (editingPage.version_history.length - i);
                  const pubDate = entry.published_at ? new Date(entry.published_at).toLocaleString() : "Unknown date";
                  const secCount = entry.sections_count ?? (entry.published_config?.sections?.length || entry.snapshot?.sections?.length || 0);

                  return (
                    <div
                      key={entry.version_id || `ver_${i}`}
                      className="p-3.5 rounded-xl border border-ui-border-base bg-ui-bg-subtle/30 hover:border-ui-border-strong transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="px-2 py-1 rounded-md bg-brand-navy text-brand-warm-white text-xs font-mono font-bold">
                          v{verNum}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-ui-fg-base">
                              {entry.title || editingPage.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-ui-bg-subtle text-ui-fg-muted">
                              {secCount} sections
                            </span>
                          </div>
                          <p className="text-[11px] text-ui-fg-muted mt-0.5">
                            Published {pubDate} by {entry.created_by || "Admin"}
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleRollback(verNum)}
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200 shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Rollback
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-ui-border-base bg-ui-bg-subtle/20 flex justify-end">
              <Button variant="secondary" size="small" onClick={() => setShowVersionModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STICKY TOP TOOLBAR */}
      <div className="sticky top-16 z-30 flex flex-wrap items-center justify-between gap-2.5 bg-ui-bg-base/95 backdrop-blur-md p-2.5 sm:p-3 rounded-xl border border-ui-border-base shadow-sm w-full min-w-0 max-w-full">
        {/* Left: Page Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-wrap sm:flex-nowrap">
          <select
            value={selectedPageId}
            onChange={e => handleSelectPage(e.target.value)}
            className="px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs max-w-[180px] sm:max-w-[240px] truncate cursor-pointer"
          >
            {pages.map(p => (
              <option key={p.id} value={p.id} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
                {p.title} ({p.status === "published" ? "Live" : "Draft"})
              </option>
            ))}
          </select>
          <Button variant="secondary" size="small" onClick={() => setShowCreateModal(true)} title="Create New Page" className="border-slate-300 hover:bg-slate-100 text-slate-800 shrink-0">
            <Plus className="w-3.5 h-3.5" />
          </Button>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 ml-1 shrink-0">
            {isDirty ? (
              <span className="px-2 py-0.5 rounded-full bg-brand-gold text-white text-[10px] font-bold animate-pulse">
                Unsaved Changes
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-semibold border border-emerald-200 dark:border-emerald-800">
                All Changes Saved
              </span>
            )}
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center justify-center gap-0.5 sm:gap-1 bg-ui-bg-subtle p-1 rounded-xl border border-ui-border-base self-center shrink-0">
          <button
            onClick={() => setCanvasDevice("desktop")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              canvasDevice === "desktop" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> <span className="hidden md:inline">Desktop</span> <span className="text-[10px] sm:text-xs opacity-75">(1440)</span>
          </button>
          <button
            onClick={() => setCanvasDevice("tablet")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              canvasDevice === "tablet" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" /> <span className="hidden md:inline">Tablet</span> <span className="text-[10px] sm:text-xs opacity-75">(768)</span>
          </button>
          <button
            onClick={() => setCanvasDevice("mobile")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              canvasDevice === "mobile" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> <span className="hidden md:inline">Mobile</span> <span className="text-[10px] sm:text-xs opacity-75">(375)</span>
          </button>
          <button
            onClick={() => setCanvasDevice("full")}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
              canvasDevice === "full" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            Full
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 justify-end flex-wrap shrink-0">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>

          <Button
            variant="secondary"
            size="small"
            onClick={() => setShowVersionModal(true)}
            title="Revision History & Rollback"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold"
          >
            <Clock className="w-3.5 h-3.5 text-brand-gold" />
            <span>Revisions ({editingPage.version_history?.length || 0})</span>
          </Button>

          <Button
            variant="secondary"
            size="small"
            onClick={() => {
              const slug = editingPage.slug === "home" ? "" : editingPage.slug;
              window.open(`/${slug}?preview=true`, "_blank");
            }}
            title="Open live storefront preview in new tab"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Preview</span>
          </Button>

          <Button variant="secondary" size="small" onClick={handleDuplicate} className="text-xs">
            <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
          </Button>

          <Button
            variant="secondary"
            size="small"
            onClick={handleSaveDraft}
            disabled={!isDirty || saving}
            data-testid="cms-save-draft-btn"
            className="border-slate-300 text-brand-deep dark:text-white dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold disabled:opacity-40 disabled:cursor-not-allowed text-xs flex items-center gap-1.5"
          >
            {saving ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-navy dark:text-brand-gold" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-brand-navy dark:text-brand-gold" />
                <span>Save Draft</span>
              </>
            )}
          </Button>

          {editingPage.status === "published" && (
            <Button
              variant="secondary"
              size="small"
              onClick={handleUnpublish}
              data-testid="cms-unpublish-btn"
              className="border-brand-gold/40 text-brand-gold-dark hover:bg-brand-gold-light font-semibold text-xs"
            >
              <EyeOff className="w-3.5 h-3.5 mr-1 text-brand-gold" /> Unpublish
            </Button>
          )}

          <Button
            variant="primary"
            size="small"
            onClick={handlePublish}
            disabled={publishing}
            data-testid="cms-publish-btn"
            className="bg-brand-navy hover:bg-brand-deep text-white border border-brand-gold/50 font-bold shadow-sm disabled:opacity-50 text-xs flex items-center gap-1.5"
          >
            {publishing ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-gold" />
                <span>Publishing to PostgreSQL...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5 text-brand-gold" />
                <span>{editingPage.status === "published" ? "Publish Changes" : "Publish"}</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* MOBILE DASHBOARD RESPONSIVE PANEL TAB SWITCHER */}
      <div className="shrink-0 flex lg:hidden items-center justify-around bg-ui-bg-subtle p-1 rounded-xl border border-ui-border-base text-xs font-bold">
        <button
          onClick={() => setMobilePanelTab("sections")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "sections" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted"}`}
        >
          📑 Sections ({getSections().length})
        </button>
        <button
          onClick={() => setMobilePanelTab("preview")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "preview" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted"}`}
        >
          👁️ Preview Canvas
        </button>
        <button
          onClick={() => setMobilePanelTab("settings")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "settings" ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted"}`}
        >
          ⚙️ Inspector
        </button>
      </div>

      {/* MAIN VIEWPORT-CONSTRAINED 3-PANEL WORKSPACE */}
      <div className="grid grid-cols-12 gap-3 lg:h-[calc(100vh-140px)] min-h-[600px] items-stretch min-w-0 max-w-full rounded-xl">

        {/* LEFT PANEL: Section Tree & Layers (~3 cols) */}
        <div className={`col-span-12 lg:col-span-3 bg-ui-bg-base border border-ui-border-base rounded-xl p-3 flex-col gap-3 h-full overflow-y-auto overscroll-y-auto min-h-0 min-w-0 max-w-full ${mobilePanelTab === "sections" ? "flex" : "hidden lg:flex"}`}>
          {/* Navigator Header */}
          <div className="flex items-center justify-between pb-2 border-b border-ui-border-base">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              <Text className="text-xs font-bold text-ui-fg-base">
                Layers ({getSections().length})
              </Text>
            </div>
            <button
              onClick={() => setShowAddSectionModal(true)}
              className="px-2 py-1 rounded-lg bg-brand-navy text-white hover:bg-brand-deep font-bold text-xs flex items-center gap-1 shadow-sm border border-brand-gold/30 transition-all"
              title="Add Section"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {/* Quick Page Settings Selector Button */}
          <button
            type="button"
            onClick={() => setConfiguringSection(null)}
            className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold flex items-center justify-between border transition-all ${
              configuringSection === null
                ? "bg-brand-navy/10 border-brand-navy text-brand-navy dark:bg-brand-navy/30 dark:border-brand-gold dark:text-brand-warm-white shadow-sm"
                : "bg-ui-bg-subtle/50 border-ui-border-base text-ui-fg-muted hover:text-ui-fg-base hover:border-ui-border-strong"
            }`}
          >
            <span className="flex items-center gap-2">
              <Settings className="w-3.5 h-3.5 text-brand-gold" />
              <span>Page Global Settings</span>
            </span>
            {configuringSection === null && (
              <Badge color="blue" className="text-[9px] px-1.5 py-0.5 bg-brand-navy text-brand-gold border border-brand-gold/30">Editing</Badge>
            )}
          </button>

          {/* Search / Filter Sections */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-ui-fg-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Filter sections..."
              value={sectionListFilter}
              onChange={(e) => setSectionListFilter(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg outline-none focus:ring-1 focus:ring-brand-gold text-ui-fg-base"
            />
          </div>

          {/* Section Items */}
          {getSections().length === 0 ? (
            <div className="text-center py-10 text-xs text-ui-fg-muted">
              No sections added. Click "+ Add" above.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {getSections()
                .filter((sec: any) => {
                  if (!sectionListFilter.trim()) return true;
                  const q = sectionListFilter.toLowerCase();
                  return (sec.name && sec.name.toLowerCase().includes(q)) || (sec.type && sec.type.toLowerCase().includes(q));
                })
                .map((sec: any) => {
                  const idx = getSections().findIndex((s: any) => s.id === sec.id);
                  const isSelected = configuringSection === sec.id;
                  const isDragOver = dragOverSectionIndex === idx;
                  return (
                    <div
                      key={sec.id}
                      data-testid={`section-item-${sec.type}`}
                      data-section-id={sec.id}
                      data-section-type={sec.type}
                      draggable={true}
                      onDragStart={e => handleDragStart(e, idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDrop={e => handleDrop(e, idx)}
                      onDragEnd={() => { setDraggedSectionIndex(null); setDragOverSectionIndex(null); }}
                      onClick={() => {
                        setConfiguringSection(sec.id);
                        scrollToSectionInCanvas(sec.id);
                      }}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                        isDragOver
                          ? "border-brand-gold border-2 scale-[1.02] shadow-lg bg-brand-navy/20 dark:bg-brand-navy/40"
                          : isSelected
                          ? "bg-brand-navy/10 border-brand-navy shadow-md dark:bg-brand-navy/30 dark:border-brand-gold ring-1 ring-brand-gold"
                          : sec.enabled !== false
                          ? "bg-ui-bg-subtle/50 border-ui-border-base hover:border-brand-gold/40"
                          : "bg-ui-bg-subtle/20 border-dashed border-ui-border-base opacity-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <div className="cursor-grab active:cursor-grabbing text-ui-fg-muted hover:text-ui-fg-base shrink-0" title="Drag to reorder">
                            <GripVertical className="w-3.5 h-3.5 shrink-0" />
                          </div>
                          <SectionIcon type={sec.type} />
                          <Text className="text-xs font-bold truncate flex-1">{sec.name}</Text>
                        </div>
                        <Badge color={sec.enabled !== false ? "green" : "grey"} className="text-[8px] px-1 py-0 shrink-0">
                          {sec.enabled !== false ? "Active" : "Off"}
                        </Badge>
                      </div>

                      {/* Quick Reorder / Actions */}
                      <div className="flex items-center justify-end gap-1 pt-1 border-t border-ui-border-base/40" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => toggleSection(sec.id)}
                          className="p-1 rounded text-ui-fg-muted hover:text-ui-fg-base"
                          title={sec.enabled ? "Disable section" : "Enable section"}
                        >
                          <Eye className={`w-3 h-3 ${sec.enabled !== false ? "text-emerald-600" : "text-ui-fg-muted"}`} />
                        </button>
                        <button
                          onClick={() => moveSectionUp(idx)}
                          disabled={idx === 0}
                          className="p-1 rounded text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-20"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => moveSectionDown(idx)}
                          disabled={idx === getSections().length - 1}
                          className="p-1 rounded text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-20"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => duplicateSection(sec.id)}
                          className="p-1 rounded text-ui-fg-muted hover:text-ui-fg-base"
                          title="Duplicate"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => removeSection(sec.id)}
                          className="p-1 rounded text-ui-fg-muted hover:text-red-500"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* CENTER PANEL: Controlled Live Studio Canvas (~6 cols) */}
        <div className={`col-span-12 lg:col-span-6 bg-ui-bg-subtle/80 rounded-xl border border-ui-border-base h-full flex flex-col min-h-0 min-w-0 max-w-full overflow-hidden ${mobilePanelTab === "preview" ? "flex" : "hidden lg:flex"}`}>
          {/* Canvas Header */}
          <div className="shrink-0 p-3 bg-ui-bg-base border-b border-ui-border-base flex items-center justify-between text-xs font-semibold text-ui-fg-muted rounded-t-xl">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-brand-navy dark:text-brand-gold" />
              Viewport: {canvasDevice === "mobile" ? "375px (Mobile)" : canvasDevice === "tablet" ? "768px (Tablet)" : canvasDevice === "desktop" ? "1100px (Desktop)" : "Full Width"}
            </span>
            <span className="text-[11px] text-ui-fg-subtle">Click any element to inspect & configure</span>
          </div>

          {/* Internal Scrollable Canvas Container */}
          <div
            id="center-canvas-scroll"
            ref={centerCanvasRef}
            className="flex-1 overflow-y-auto overscroll-y-auto overflow-x-auto p-4 sm:p-6 flex justify-center items-start scrollbar-thin rounded-b-xl max-w-full w-full"
          >
            <div
              className={`bg-white dark:bg-ui-bg-base rounded-2xl shadow-2xl overflow-hidden border border-ui-border-base transition-all duration-300 my-auto ${
                canvasDevice === "mobile"
                  ? "w-[375px]"
                  : canvasDevice === "tablet"
                  ? "w-[768px]"
                  : canvasDevice === "desktop"
                  ? "w-[1100px]"
                  : "w-full"
              }`}
            >
              <div className="p-4 sm:p-6">
                <PageRenderer
                  sections={editingPage.sections || []}
                  banners={editingPage.draft_config?.banners || []}
                  allProducts={allProducts}
                  allCategories={allCategories}
                  occasions={allOccasions}
                  announcementBar={editingPage.announcement_bar}
                  h1={editingPage.h1 || editingPage.title}
                  subheading={editingPage.subheading}
                  introContent={editingPage.intro_content}
                  theme={editingPage.theme}
                  isPreview={true}
                  selectedSectionId={configuringSection}
                  onSectionClick={(id) => {
                    setConfiguringSection(id);
                    scrollToSectionInCanvas(id);
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Contextual Property Inspector (~3 cols) */}
        <div className={`col-span-12 lg:col-span-3 bg-ui-bg-base border border-ui-border-base rounded-xl p-4 flex-col gap-4 h-full overflow-y-auto overscroll-y-auto min-h-0 min-w-0 max-w-full ${mobilePanelTab === "settings" ? "flex" : "hidden lg:flex"}`}>
          {configuringSection && selectedSection ? (
            /* SECTION EDITOR MODE */
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-ui-border-base">
                <button
                  type="button"
                  onClick={() => setConfiguringSection(null)}
                  className="text-xs font-bold text-brand-navy hover:text-brand-deep dark:text-brand-gold flex items-center gap-1 transition-colors"
                >
                  ← Page Settings
                </button>
                <Badge color="blue" className="text-[10px]">
                  {selectedSection.type}
                </Badge>
              </div>
              <SectionConfigEditor
                section={selectedSection}
                allProducts={allProducts}
                allCategories={allCategories}
                allOccasions={allOccasions}
                updateSectionField={updateSectionField}
                updateSectionConfig={updateSectionConfig}
                updateSectionWholeConfig={updateSectionWholeConfig}
                updateSectionNestedConfig={updateSectionNestedConfig}
                openImagePicker={openImagePicker}
                onClose={() => setConfiguringSection(null)}
              />
            </div>
          ) : (
            /* PAGE GLOBAL SETTINGS MODE */
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between pb-1 border-b border-ui-border-base">
                <Text className="text-xs font-bold uppercase tracking-wider text-ui-fg-subtle">
                  Page Settings
                </Text>
                <Badge color="green" className="text-[9px]">
                  {editingPage.status === "published" ? "Live" : "Draft"}
                </Badge>
              </div>

              {/* Tab Navigation Bar */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none">
                {[
                  { id: "general", label: "General" },
                  ...((editingPage.page_type === "product" || editingPage.slug === "product") ? [{ id: "pdp", label: "PDP Layout" }] : []),
                  ...(editingPage.slug === "login" ? [{ id: "login", label: "Login Page" }] : []),
                  { id: "seo", label: "SEO" },
                  { id: "theme", label: "Theme" },
                  { id: "visibility", label: "Visibility" },
                  { id: "marketing", label: "Bar" },
                  { id: "publish", label: "Publish" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as PageTab)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      activeTab === t.id ? "bg-brand-navy text-white shadow-sm border border-brand-gold/30" : "text-ui-fg-muted hover:bg-ui-bg-subtle"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* General Tab */}
              {activeTab === "general" && (
                <div className="flex flex-col gap-3">
                  <Field label="Page Title">
                    <input
                      type="text"
                      value={editingPage.title || ""}
                      onChange={e => updateField("title", e.target.value)}
                      placeholder="Page Title"
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="URL Slug">
                    <input
                      type="text"
                      value={editingPage.slug || ""}
                      onChange={e => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                      placeholder="e.g. birthday-cakes"
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="Page Type">
                    <select
                      value={editingPage.page_type || "landing"}
                      onChange={e => updateField("page_type", e.target.value)}
                      className="w-full py-2 px-3 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs cursor-pointer"
                    >
                      {PAGE_TYPES.map(t => (
                        <option key={t.value} value={t.value} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="H1 Headline">
                    <input
                      type="text"
                      value={editingPage.h1 || ""}
                      onChange={e => updateField("h1", e.target.value)}
                      placeholder={editingPage.title || "Page H1 Headline"}
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="Subheading">
                    <input
                      type="text"
                      value={editingPage.subheading || ""}
                      onChange={e => updateField("subheading", e.target.value)}
                      placeholder="Descriptive subheading"
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="Intro Content">
                    <textarea
                      value={editingPage.intro_content || ""}
                      onChange={e => updateField("intro_content", e.target.value)}
                      rows={3}
                      placeholder="Introductory body text..."
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs resize-y"
                    />
                  </Field>
                </div>
              )}

              {/* PDP Tab */}
              {activeTab === "pdp" && (editingPage.page_type === "product" || editingPage.slug === "product") && (
                <PdpBuilderEditor
                  config={editingPage.pdp_config || {}}
                  onChange={(key, val) =>
                    updateField("pdp_config", {
                      ...(editingPage.pdp_config || {}),
                      [key]: val,
                    })
                  }
                />
              )}

              {/* Login Page Tab: side image, headline and selling points shown next to the login form */}
              {activeTab === "login" && editingPage.slug === "login" && (() => {
                const lc = editingPage.login_config || {};
                const setLc = (key: string, val: any) => updateField("login_config", { ...lc, [key]: val });
                return (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      {lc.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={lc.image_url} alt={lc.image_alt || ""} className="w-28 h-20 object-cover rounded-lg border border-ui-border-base" />
                      ) : (
                        <div className="w-28 h-20 rounded-lg border border-dashed border-ui-border-base flex items-center justify-center text-[10px] text-ui-fg-muted">Default image</div>
                      )}
                      <div className="flex flex-col gap-1">
                        <Button
                          variant="secondary"
                          size="small"
                          onClick={() => openImagePicker("Login Page Image", { url: lc.image_url, alt: lc.image_alt }, (sel) => updateField("login_config", { ...lc, image_url: sel.url, image_alt: sel.alt || lc.image_alt || "" }))}
                        >
                          <ImageIcon className="w-3.5 h-3.5 mr-1" /> {lc.image_url ? "Change image" : "Select image"}
                        </Button>
                        {lc.image_url && (
                          <button type="button" className="text-[10px] text-rose-600 text-left" onClick={() => setLc("image_url", "")}>Use default image</button>
                        )}
                      </div>
                    </div>
                    <Field label="Image alt text">
                      <input type="text" value={lc.image_alt || ""} onChange={(e) => setLc("image_alt", e.target.value)} placeholder="Freshly baked chocolate cake" className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-800" />
                    </Field>
                    <Field label="Headline">
                      <input type="text" value={lc.headline || ""} onChange={(e) => setLc("headline", e.target.value)} placeholder="Fresh cakes, handcrafted for your moments." className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-800" />
                    </Field>
                    <Field label="Selling points (one per line)">
                      <textarea
                        rows={4}
                        value={Array.isArray(lc.points) ? lc.points.join("\n") : ""}
                        onChange={(e) => setLc("points", e.target.value.split("\n"))}
                        placeholder={"Baked fresh on order\nSame-day delivery slots\nDelivered across Kerala"}
                        className="w-full p-2 border rounded-lg text-xs bg-white dark:bg-slate-800"
                      />
                    </Field>
                    <Text className="text-[10px] text-ui-fg-muted">Changes show on the login page after you save.</Text>
                  </div>
                );
              })()}

              {/* SEO Tab */}
              {activeTab === "seo" && (
                <div className="flex flex-col gap-3">
                  <Field label="Meta Title">
                    <input
                      type="text"
                      value={editingPage.meta_title || ""}
                      onChange={e => updateField("meta_title", e.target.value)}
                      placeholder="Page title for search engines (50-60 chars)"
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="Meta Description">
                    <textarea
                      value={editingPage.meta_description || ""}
                      onChange={e => updateField("meta_description", e.target.value)}
                      rows={3}
                      placeholder="Brief summary for search snippets (120-160 chars)"
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs resize-y"
                    />
                  </Field>
                  <Field label="Canonical URL">
                    <input
                      type="text"
                      value={editingPage.canonical_url || ""}
                      onChange={e => updateField("canonical_url", e.target.value)}
                      placeholder="https://caketohome.com/..."
                      className="w-full py-2 px-3 text-xs font-medium text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs"
                    />
                  </Field>
                  <Field label="Robots Meta">
                    <select
                      value={editingPage.robots || "index, follow"}
                      onChange={e => updateField("robots", e.target.value)}
                      className="w-full py-2 px-3 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs cursor-pointer"
                    >
                      {ROBOTS_OPTIONS.map(r => (
                        <option key={r} value={r} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
                          {r}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Structured Data Type">
                    <select
                      value={editingPage.structured_data_type || "WebPage"}
                      onChange={e => updateField("structured_data_type", e.target.value)}
                      className="w-full py-2 px-3 text-xs font-semibold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-brand-navy shadow-xs cursor-pointer"
                    >
                      {STRUCTURED_DATA_TYPES.map(s => (
                        <option key={s} value={s} className="text-slate-900 bg-white dark:text-white dark:bg-slate-800 py-1">
                          {s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <div className="flex items-center justify-between pt-2 border-t border-ui-border-base">
                    <div>
                      <Text className="text-xs font-bold">Social Share Image (OG)</Text>
                      <Text className="text-[10px] text-ui-fg-muted">{editingPage.og_image ? "Image set" : "Using default"}</Text>
                    </div>
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => openImagePicker("Social Share Image", { url: editingPage.og_image }, (sel) => updateField("og_image", sel.url))}
                    >
                      <ImageIcon className="w-3.5 h-3.5 mr-1" /> Select
                    </Button>
                  </div>
                </div>
              )}

              {/* Theme Tab */}
              {activeTab === "theme" && (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2 pb-2 border-b border-ui-border-base">
                    <Text className="text-xs font-bold text-rose-600">Style & Theme Presets</Text>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const royalNavyTheme = {
                            bg_color: "#FFFCF8",
                            text_color: "#152347",
                            heading_color: "#1D2F5D",
                            accent_color: "#C28A2C",
                            font_family: "'Plus Jakarta Sans', sans-serif",
                            heading_font: "'Playfair Display', serif",
                            card_style: "luxury",
                          };
                          setEditingPage((prev: any) => ({ ...prev, theme: royalNavyTheme }));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-brand-navy text-brand-gold border border-brand-gold/50 hover:bg-brand-navy font-semibold transition-all shadow-sm"
                      >
                        👑 Royal Navy & Gold (#1D2F5D)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const tenebrismTheme = {
                            bg_color: "radial-gradient(ellipse at top right, #1D2F5D 0%, #152347 50%, #152347 100%)",
                            text_color: "#FFFCF8",
                            heading_color: "#C28A2C",
                            accent_color: "#C28A2C",
                            font_family: "'Outfit', sans-serif",
                            heading_font: "'Playfair Display', serif",
                            card_style: "tenebrism",
                          };
                          setEditingPage((prev: any) => ({ ...prev, theme: tenebrismTheme }));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-brand-deep text-brand-gold border border-brand-gold/40 hover:bg-brand-navy font-medium transition-all"
                      >
                        🕯️ Tenebrism Chiaroscuro
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const coquetteTheme = {
                            bg_color: "#FFF5F7",
                            text_color: "#4A044E",
                            heading_color: "#BE185D",
                            accent_color: "#F472B6",
                            font_family: "'Plus Jakarta Sans', sans-serif",
                            heading_font: "'Playfair Display', serif",
                            card_style: "coquette",
                          };
                          setEditingPage((prev: any) => ({ ...prev, theme: coquetteTheme }));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-[#FFF5F7] text-[#BE185D] border border-brand-primary/30 hover:bg-brand-light font-medium transition-all"
                      >
                        🎀 Coquette Blush
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const scrapbookTheme = {
                            bg_color: "#FFFCF8",
                            text_color: "#1E293B",
                            heading_color: "#1D2F5D",
                            accent_color: "#C28A2C",
                            font_family: "'Plus Jakarta Sans', sans-serif",
                            heading_font: "'Playfair Display', serif",
                            card_style: "scrapbook",
                          };
                          setEditingPage((prev: any) => ({ ...prev, theme: scrapbookTheme }));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-brand-warm-white text-[#997A1E] border border-brand-gold/30 hover:bg-brand-gold-light font-medium transition-all"
                      >
                        📖 Memory Scrapbook
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const japandiTheme = {
                            bg_color: "#FFFCF8",
                            text_color: "#1E293B",
                            heading_color: "#172033",
                            accent_color: "#6B7280",
                            font_family: "'Plus Jakarta Sans', sans-serif",
                            heading_font: "'Plus Jakarta Sans', sans-serif",
                            card_style: "japandi",
                          };
                          setEditingPage((prev: any) => ({ ...prev, theme: japandiTheme }));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-brand-surface-muted text-slate-700 border border-slate-200 hover:bg-slate-100 font-medium transition-all"
                      >
                        🌿 Japandi Wabi-Sabi
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Card Visual Style">
                      <Select
                        value={editingPage.theme?.card_style || "default"}
                        onValueChange={v => updateNestedField("theme", "card_style", v)}
                      >
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          <Select.Item value="default">Default Clean Solid</Select.Item>
                          <Select.Item value="glass">🪟 Glassmorphism (Frosted)</Select.Item>
                          <Select.Item value="scrapbook">📖 Scrapbook (Polaroid + Washi)</Select.Item>
                          <Select.Item value="coquette">🎀 Coquette (Blush + Ribbon)</Select.Item>
                          <Select.Item value="tenebrism">🕯️ Tenebrism (Spotlight Glow)</Select.Item>
                          <Select.Item value="japandi">🌿 Japandi (Minimal Calm)</Select.Item>
                          <Select.Item value="luxury">✨ Luxury Patisserie</Select.Item>
                        </Select.Content>
                      </Select>
                    </Field>
                    <Field label="Surface Glass Blur">
                      <Select
                        value={editingPage.theme?.glass_mode ? "active" : "disabled"}
                        onValueChange={v => updateNestedField("theme", "glass_mode", v === "active")}
                      >
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          <Select.Item value="disabled">Opaque Solid Surfaces</Select.Item>
                          <Select.Item value="active">Backdrop Blur Enabled</Select.Item>
                        </Select.Content>
                      </Select>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Page Background">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingPage.theme?.bg_color?.startsWith("#") ? editingPage.theme.bg_color : "#ffffff"}
                          onChange={e => updateNestedField("theme", "bg_color", e.target.value)}
                          className="h-8 w-10 rounded border border-ui-border-base cursor-pointer"
                        />
                        <Input
                          value={editingPage.theme?.bg_color || "#ffffff"}
                          onChange={e => updateNestedField("theme", "bg_color", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field label="Text Color">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingPage.theme?.text_color || "#1f2937"}
                          onChange={e => updateNestedField("theme", "text_color", e.target.value)}
                          className="h-8 w-10 rounded border border-ui-border-base cursor-pointer"
                        />
                        <Input
                          value={editingPage.theme?.text_color || "#1f2937"}
                          onChange={e => updateNestedField("theme", "text_color", e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Heading Color">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingPage.theme?.heading_color || "#111827"}
                          onChange={e => updateNestedField("theme", "heading_color", e.target.value)}
                          className="h-8 w-10 rounded border border-ui-border-base cursor-pointer"
                        />
                        <Input
                          value={editingPage.theme?.heading_color || "#111827"}
                          onChange={e => updateNestedField("theme", "heading_color", e.target.value)}
                        />
                      </div>
                    </Field>
                    <Field label="Accent Color">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingPage.theme?.accent_color || "#C28A2C"}
                          onChange={e => updateNestedField("theme", "accent_color", e.target.value)}
                          className="h-8 w-10 rounded border border-ui-border-base cursor-pointer"
                        />
                        <Input
                          value={editingPage.theme?.accent_color || "#C28A2C"}
                          onChange={e => updateNestedField("theme", "accent_color", e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>

                  <Text className="text-xs font-bold text-brand-navy dark:text-brand-gold pt-2">Typography & Style</Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Body Font Family">
                      <Select
                        value={editingPage.theme?.font_family || "inherit"}
                        onValueChange={v => updateNestedField("theme", "font_family", v)}
                      >
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          <Select.Item value="inherit">Default System</Select.Item>
                          <Select.Item value="var(--font-inter), sans-serif">Inter</Select.Item>
                          <Select.Item value="'Outfit', sans-serif">Outfit</Select.Item>
                          <Select.Item value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</Select.Item>
                          <Select.Item value="'Montserrat', sans-serif">Montserrat</Select.Item>
                        </Select.Content>
                      </Select>
                    </Field>
                    <Field label="Heading Font Family">
                      <Select
                        value={editingPage.theme?.heading_font || "inherit"}
                        onValueChange={v => updateNestedField("theme", "heading_font", v)}
                      >
                        <Select.Trigger><Select.Value /></Select.Trigger>
                        <Select.Content>
                          <Select.Item value="inherit">Default System</Select.Item>
                          <Select.Item value="'Playfair Display', serif">Playfair Display (Serif)</Select.Item>
                          <Select.Item value="'Outfit', sans-serif">Outfit (Modern)</Select.Item>
                          <Select.Item value="'Plus Jakarta Sans', sans-serif">Plus Jakarta Sans</Select.Item>
                          <Select.Item value="'Cinzel', serif">Cinzel (Luxury)</Select.Item>
                        </Select.Content>
                      </Select>
                    </Field>
                  </div>
                </div>
              )}

              {/* Visibility Tab */}
              {activeTab === "visibility" && (
                <div className="flex flex-col gap-3">
                  <Field label="Audience">
                    <Select value={editingPage.visibility_rules?.audience || "public"} onValueChange={v => updateNestedField("visibility_rules", "audience", v)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content>
                        <Select.Item value="public">Public (Everyone)</Select.Item>
                        <Select.Item value="logged_in">Logged-in Members Only</Select.Item>
                        <Select.Item value="guests">Guests Only</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Target Devices">
                    <Select value={editingPage.visibility_rules?.devices || "all"} onValueChange={v => updateNestedField("visibility_rules", "devices", v)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content>
                        <Select.Item value="all">All Devices</Select.Item>
                        <Select.Item value="desktop">Desktop Only</Select.Item>
                        <Select.Item value="mobile">Mobile Only</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Navigation Location">
                    <Select value={editingPage.nav_location || "none"} onValueChange={v => updateField("nav_location", v)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content>
                        <Select.Item value="header">Header Nav</Select.Item>
                        <Select.Item value="footer">Footer Links</Select.Item>
                        <Select.Item value="mobile">Mobile Drawer</Select.Item>
                        <Select.Item value="none">None</Select.Item>
                      </Select.Content>
                    </Select>
                  </Field>
                </div>
              )}

              {/* Marketing Tab */}
              {activeTab === "marketing" && (
                <div className="flex flex-col gap-3">
                  <AnnouncementBarEditor
                    config={editingPage.announcement_bar || {}}
                    onChange={(newCfg) => updateField("announcement_bar", newCfg)}
                  />
                </div>
              )}

              {/* Publish Tab */}
              {activeTab === "publish" && (
                <div className="flex flex-col gap-3">
                  <Text className="text-xs font-bold text-brand-navy dark:text-brand-gold">Pre-Publish Checklist</Text>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.title ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>Page Title Set</span>
                      {editingPage.title ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.slug ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>URL Slug Valid</span>
                      {editingPage.slug ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.meta_title ? "bg-emerald-50 text-emerald-700" : "bg-brand-gold-light text-brand-gold-dark"}`}>
                      <span>Meta Title (SEO)</span>
                      {editingPage.meta_title ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${getSections().length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>Sections Configured ({getSections().length})</span>
                      {getSections().length > 0 ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={publishing || saving}
                    onClick={handlePublish}
                    className="w-full mt-2 inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-navy text-white hover:bg-brand-deep active:scale-[0.99] disabled:opacity-50 transition shadow-sm border border-brand-navy"
                  >
                    {publishing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-brand-gold" />
                        <span>Publishing to PostgreSQL...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 text-brand-gold" />
                        <span>Publish Storefront Now</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
