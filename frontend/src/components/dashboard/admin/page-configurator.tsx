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
  GripVertical, Gift, Zap
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
type PageTab = "general" | "pdp" | "seo" | "theme" | "visibility" | "marketing" | "advanced" | "publish";
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
  const color = score >= 80 ? "text-emerald-600" : score >= 60 ? "text-blue-600" : score >= 40 ? "text-amber-600" : "text-red-600";
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
    announcement_bar: { enabled: false, text: "", cta_text: "", cta_url: "", bg_color: "#e11d48" },
    theme: { bg_color: "#ffffff", text_color: "#1f2937", heading_color: "#111827", accent_color: "#e11d48" },
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
      <Label className="text-xs font-semibold text-ui-fg-base">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ui-fg-muted">{hint}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? "bg-rose-500" : "bg-ui-bg-component border border-ui-border-base"}`}
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
    loadAll();
  }, []);

  const loadAll = async (targetPageId?: string) => {
    setLoading(true);
    try {
      const [pagesRes, productsRes, catsRes, occsRes] = await Promise.allSettled([
        apiClient.getCmsPages(),
        apiClient.getAdminProducts(),
        apiClient.getAdminCategories(),
        apiClient.getAdminOccasions(),
      ]);
      const fetchedPages = (pagesRes.status === "fulfilled" ? (pagesRes.value as any)?.pages : null) || [];
      setPages(fetchedPages);
      setAllProducts((productsRes.status === "fulfilled" ? (productsRes.value as any)?.products : null) || []);
      setAllCategories((catsRes.status === "fulfilled" ? (catsRes.value as any)?.categories : null) || []);
      setAllOccasions((occsRes.status === "fulfilled" ? (occsRes.value as any)?.occasions : null) || []);

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
      if (editingPage.id && pages.some((p) => p.id === editingPage.id)) {
        res = await apiClient.updateCmsPage(editingPage.id, editingPage);
      } else {
        res = await apiClient.createCmsPage(editingPage);
      }
      const updated = res?.page || res;
      setSavedSnapshot(JSON.stringify(updated));
      showToast("Draft saved successfully!");
      await loadAll(updated?.id || editingPage.id);
      if (updated?.id) setSelectedPageId(updated.id);
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) {
        return;
      }
      if (err?.name === "TimeoutError" || err?.message?.includes("timed out")) {
        showToast("Save draft request timed out. Your changes are persisting in the background; please refresh shortly.", "error");
        return;
      }
      showToast(err?.message || "Failed to save draft", "error");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (editingPage.id && pages.some((p) => p.id === editingPage.id)) {
        await apiClient.updateCmsPage(editingPage.id, editingPage);
      }
      const res: any = await apiClient.publishCmsPage(editingPage.id);
      if (res?.success === false || res?.errors?.length > 0) {
        const errs = res?.errors || ["Validation failed"];
        setValidationResult({ valid: false, errors: errs, warnings: res?.warnings || [] });
        setActiveTab("publish");
        setConfiguringSection(null);
        showToast("Fix validation errors before publishing", "error");
      } else {
        showToast("Page published successfully! Customer storefront updated. 🎉");
        setValidationResult(null);
        setSavedSnapshot(JSON.stringify(res.page));
        await loadAll(res?.page?.id || editingPage.id);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" && !err?.message?.includes("timed out")) {
        return;
      }
      if (err?.name === "TimeoutError" || err?.message?.includes("timed out")) {
        showToast("Publish request timed out while writing to database. Please refresh shortly to verify status.", "error");
        return;
      }
      showToast(err?.message || "Failed to publish", "error");
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    try {
      await apiClient.unpublishCmsPage(editingPage.id);
      showToast("Page unpublished — set back to Draft");
      await loadAll(editingPage.id);
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
              <Select value={newPageForm.page_type} onValueChange={v => setNewPageForm(prev => ({ ...prev, page_type: v }))}>
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  {PAGE_TYPES.map(t => <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>)}
                </Select.Content>
              </Select>
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
                        ? "bg-rose-500 text-white shadow-sm"
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
                            ? "bg-rose-500 text-white shadow-sm"
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
                          className="p-3 rounded-xl text-left flex items-start gap-3 transition-all border bg-ui-bg-subtle/30 border-ui-border-base hover:bg-rose-50 hover:border-rose-300 hover:shadow-sm dark:hover:bg-rose-950/20 group"
                        >
                          <span className="text-xl shrink-0 mt-0.5">{st.icon}</span>
                          <div className="min-w-0">
                            <Text className="text-xs font-bold group-hover:text-rose-700 dark:group-hover:text-rose-400 truncate">{st.label}</Text>
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

      {/* STICKY TOP TOOLBAR */}
      <div className="sticky top-16 z-30 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-ui-bg-base/95 backdrop-blur-md p-3 rounded-xl border border-ui-border-base shadow-sm">
        {/* Left: Page Selector */}
        <div className="flex items-center gap-2">
          <select
            value={selectedPageId}
            onChange={e => handleSelectPage(e.target.value)}
            className="px-3 py-1.5 text-xs font-bold bg-ui-bg-subtle border border-ui-border-base rounded-lg outline-none focus:ring-2 focus:ring-rose-500 max-w-[220px]"
          >
            {pages.map(p => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.status === "published" ? "Live" : "Draft"})
              </option>
            ))}
          </select>
          <Button variant="secondary" size="small" onClick={() => setShowCreateModal(true)} title="Create New Page">
            <Plus className="w-3.5 h-3.5" />
          </Button>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5 ml-2">
            {isDirty ? (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold animate-pulse">
                Unsaved Changes
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                All Changes Saved
              </span>
            )}
          </div>
        </div>

        {/* Center: Device Viewport Switcher */}
        <div className="flex items-center justify-center gap-1 bg-ui-bg-subtle p-1 rounded-xl border border-ui-border-base self-center">
          <button
            onClick={() => setCanvasDevice("desktop")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canvasDevice === "desktop" ? "bg-rose-600 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop (1440)
          </button>
          <button
            onClick={() => setCanvasDevice("tablet")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canvasDevice === "tablet" ? "bg-rose-600 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Tablet className="w-3.5 h-3.5" /> Tablet (768)
          </button>
          <button
            onClick={() => setCanvasDevice("mobile")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canvasDevice === "mobile" ? "bg-rose-600 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Mobile (375)
          </button>
          <button
            onClick={() => setCanvasDevice("full")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              canvasDevice === "full" ? "bg-rose-600 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            Full Width
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={handleUndo}
            disabled={undoStack.length === 0}
            className="p-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="p-1.5 rounded-lg border border-ui-border-base bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base disabled:opacity-30"
            title="Redo (Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <Button variant="secondary" size="small" onClick={handleDuplicate}>
            <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
          </Button>

          <Button variant="secondary" size="small" onClick={handleSaveDraft} isLoading={saving} data-testid="cms-save-draft-btn">
            <Save className="w-3.5 h-3.5 mr-1" /> Save Draft
          </Button>

          {editingPage.status === "published" && (
            <Button variant="secondary" size="small" onClick={handleUnpublish} data-testid="cms-unpublish-btn">
              <EyeOff className="w-3.5 h-3.5 mr-1" /> Unpublish
            </Button>
          )}

          <Button variant="primary" size="small" onClick={handlePublish} isLoading={publishing} data-testid="cms-publish-btn">
            <Send className="w-3.5 h-3.5 mr-1" /> {editingPage.status === "published" ? "Publish Changes" : "Publish"}
          </Button>
        </div>
      </div>

      {/* MOBILE DASHBOARD RESPONSIVE PANEL TAB SWITCHER */}
      <div className="shrink-0 flex lg:hidden items-center justify-around bg-ui-bg-subtle p-1 rounded-xl border border-ui-border-base text-xs font-bold">
        <button
          onClick={() => setMobilePanelTab("settings")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "settings" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted"}`}
        >
          ⚙️ Settings
        </button>
        <button
          onClick={() => setMobilePanelTab("preview")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "preview" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted"}`}
        >
          👁️ Preview Canvas
        </button>
        <button
          onClick={() => setMobilePanelTab("sections")}
          className={`flex-1 py-2 text-center rounded-lg ${mobilePanelTab === "sections" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted"}`}
        >
          📑 Sections ({getSections().length})
        </button>
      </div>

      {/* MAIN VIEWPORT-CONSTRAINED 3-PANEL WORKSPACE */}
      <div className="grid grid-cols-12 gap-3 lg:h-[calc(100vh-140px)] min-h-[600px] items-stretch min-w-0 rounded-xl">

        {/* LEFT PANEL: Controls & Settings (~340px / 3 cols) */}
        <div className={`col-span-12 lg:col-span-3 bg-ui-bg-base border border-ui-border-base rounded-xl p-4 flex-col gap-4 h-full overflow-y-auto overscroll-y-auto min-h-0 ${mobilePanelTab === "settings" ? "flex" : "hidden lg:flex"}`}>
          {configuringSection && selectedSection ? (
                /* SECTION EDITOR MODE */
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
              ) : (
            /* PAGE SETTINGS MODE */
            <div className="flex flex-col gap-4">
              {/* Tab Navigation Bar */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base scrollbar-none">
                {[
                  { id: "general", label: "General" },
                  ...(editingPage.page_type === "product" ? [{ id: "pdp", label: "PDP Layout" }] : []),
                  { id: "seo", label: "SEO" },
                  { id: "theme", label: "Theme" },
                  { id: "visibility", label: "Visibility" },
                  { id: "marketing", label: "Bar" },
                  { id: "publish", label: "Publish" },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id as PageTab)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${
                      activeTab === t.id ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted hover:bg-ui-bg-subtle"
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
                    <Input
                      value={editingPage.title || ""}
                      onChange={e => updateField("title", e.target.value)}
                    />
                  </Field>
                  <Field label="URL Slug">
                    <Input
                      value={editingPage.slug || ""}
                      onChange={e => updateField("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    />
                  </Field>
                  <Field label="Page Type">
                    <Select value={editingPage.page_type || "landing"} onValueChange={v => updateField("page_type", v)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content>
                        {PAGE_TYPES.map(t => <Select.Item key={t.value} value={t.value}>{t.label}</Select.Item>)}
                      </Select.Content>
                    </Select>
                  </Field>
                  <Field label="Page Heading (H1)">
                    <Input
                      value={editingPage.h1 || editingPage.title || ""}
                      onChange={e => updateField("h1", e.target.value)}
                    />
                  </Field>
                  <Field label="Subheading">
                    <Input
                      value={editingPage.subheading || ""}
                      onChange={e => updateField("subheading", e.target.value)}
                    />
                  </Field>
                  <Field label="Intro Paragraph">
                    <Textarea
                      value={editingPage.intro_content || ""}
                      onChange={e => updateField("intro_content", e.target.value)}
                      rows={3}
                    />
                  </Field>
                </div>
              )}

              {/* PDP Layout Tab */}
              {activeTab === "pdp" && (
                <PdpBuilderEditor
                  config={editingPage.draft_config?.pdp || editingPage.published_config?.pdp || editingPage.pdp_config || {}}
                  onChange={(key, val) => {
                    setEditingPage((prev: any) => {
                      if (!prev) return prev;
                      const currentPdp = prev.draft_config?.pdp || prev.pdp_config || {};
                      const updatedPdp = { ...currentPdp, [key]: val };
                      return {
                        ...prev,
                        pdp_config: updatedPdp,
                        draft_config: {
                          ...(prev.draft_config || {}),
                          pdp: updatedPdp,
                        },
                      };
                    });
                  }}
                />
              )}

              {/* SEO Tab */}
              {activeTab === "seo" && (
                <div className="flex flex-col gap-3">
                  <div className={`p-2.5 rounded-xl border flex items-center justify-between ${seoScore.score >= 80 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
                    <span className="text-xs font-bold">SEO Score: {seoScore.score}/100</span>
                    <Badge color={seoScore.score >= 80 ? "green" : "orange"}>{seoScore.label}</Badge>
                  </div>
                  <Field label="Meta Title">
                    <Input
                      value={editingPage.meta_title || ""}
                      onChange={e => updateField("meta_title", e.target.value)}
                    />
                  </Field>
                  <Field label="Meta Description">
                    <Textarea
                      value={editingPage.meta_description || ""}
                      onChange={e => updateField("meta_description", e.target.value)}
                      rows={3}
                    />
                  </Field>
                  <Field label="Keywords">
                    <Input
                      value={editingPage.keywords || ""}
                      onChange={e => updateField("keywords", e.target.value)}
                    />
                  </Field>
                  <Field label="Canonical URL">
                    <Input
                      value={editingPage.canonical_url || ""}
                      onChange={e => updateField("canonical_url", e.target.value)}
                    />
                  </Field>
                  <Field label="Robots Tag">
                    <Select value={editingPage.robots_tag || "index, follow"} onValueChange={v => updateField("robots_tag", v)}>
                      <Select.Trigger><Select.Value /></Select.Trigger>
                      <Select.Content>
                        {ROBOTS_OPTIONS.map(r => <Select.Item key={r} value={r}>{r}</Select.Item>)}
                      </Select.Content>
                    </Select>
                  </Field>

                  {/* OpenGraph Image Picker */}
                  <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
                    <div>
                      <Label className="text-xs font-semibold">Social OG Image</Label>
                      <Text className="text-[10px] text-ui-fg-muted truncate max-w-[140px]">{editingPage.og_image || "Not set"}</Text>
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
                  <Text className="text-xs font-bold text-rose-600">Page Color Theme</Text>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Page Background">
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editingPage.theme?.bg_color || "#ffffff"}
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
                          value={editingPage.theme?.accent_color || "#e11d48"}
                          onChange={e => updateNestedField("theme", "accent_color", e.target.value)}
                          className="h-8 w-10 rounded border border-ui-border-base cursor-pointer"
                        />
                        <Input
                          value={editingPage.theme?.accent_color || "#e11d48"}
                          onChange={e => updateNestedField("theme", "accent_color", e.target.value)}
                        />
                      </div>
                    </Field>
                  </div>

                  <Text className="text-xs font-bold text-rose-600 pt-2">Typography & Style</Text>
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
                  <Text className="text-xs font-bold text-rose-600">Pre-Publish Checklist</Text>
                  <div className="flex flex-col gap-1.5 text-xs">
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.title ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>Page Title Set</span>
                      {editingPage.title ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.slug ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>URL Slug Valid</span>
                      {editingPage.slug ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${editingPage.meta_title ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                      <span>Meta Title (SEO)</span>
                      {editingPage.meta_title ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-2 rounded-lg flex items-center justify-between ${getSections().length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      <span>Sections Configured ({getSections().length})</span>
                      {getSections().length > 0 ? <Check className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                  <Button variant="primary" size="small" onClick={handlePublish} isLoading={publishing} className="w-full mt-2">
                    <Send className="w-3.5 h-3.5 mr-1" /> Publish Storefront Now
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER PANEL: Controlled Live Canvas Container (~7 cols) */}
        <div className={`col-span-12 lg:col-span-7 bg-ui-bg-subtle/80 rounded-xl border border-ui-border-base h-full flex flex-col min-h-0 min-w-0 ${mobilePanelTab === "preview" ? "flex" : "hidden lg:flex"}`}>
          {/* Canvas Header */}
          <div className="shrink-0 p-3 bg-ui-bg-base border-b border-ui-border-base flex items-center justify-between text-xs font-semibold text-ui-fg-muted rounded-t-xl">
            <span className="flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-rose-600" />
              Canvas Viewport: {canvasDevice === "mobile" ? "375px (Mobile)" : canvasDevice === "tablet" ? "768px (Tablet)" : canvasDevice === "desktop" ? "1440px (Desktop)" : "Full Width"}
            </span>
            <span className="text-[11px] text-ui-fg-subtle">Click section to edit</span>
          </div>

          {/* Internal Scrollable Canvas Container */}
          <div
            id="center-canvas-scroll"
            ref={centerCanvasRef}
            className="flex-1 overflow-y-auto overscroll-y-auto overflow-x-auto p-4 sm:p-6 flex justify-center items-start scrollbar-thin rounded-b-xl"
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
                  onSectionClick={(id) => scrollToSectionInCanvas(id)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Section Navigator (~240px / 2 cols) */}
        <div className={`col-span-12 lg:col-span-2 bg-ui-bg-base border border-ui-border-base rounded-xl p-3 flex-col gap-3 h-full overflow-y-auto overscroll-y-auto min-h-0 ${mobilePanelTab === "sections" ? "flex" : "hidden lg:flex"}`}>
          <div className="flex items-center justify-between pb-2 border-b border-ui-border-base">
            <Text className="text-[11px] font-bold uppercase tracking-wider text-ui-fg-subtle">
              Sections ({getSections().length})
            </Text>
            <button
              onClick={() => setShowAddSectionModal(true)}
              className="p-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-xs flex items-center gap-0.5"
              title="Add Section"
            >
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
          </div>

          {getSections().length === 0 ? (
            <div className="text-center py-10 text-xs text-ui-fg-muted">
              No sections added. Click "+ Add" above.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {getSections().map((sec: any, idx: number) => {
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
                    onClick={() => scrollToSectionInCanvas(sec.id)}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                      isDragOver
                        ? "border-rose-500 border-2 scale-[1.02] shadow-lg bg-rose-50/50 dark:bg-rose-950/40"
                        : isSelected
                        ? "bg-rose-50 border-rose-400 shadow-md dark:bg-rose-950/40"
                        : sec.enabled !== false
                        ? "bg-ui-bg-subtle/50 border-ui-border-base hover:border-rose-300"
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

      </div>
    </div>
  );
}
