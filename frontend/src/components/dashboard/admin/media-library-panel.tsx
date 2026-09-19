"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Image as ImageIcon,
  Upload,
  Folder,
  Search,
  Grid,
  List as ListIcon,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Eye,
  RefreshCw,
  Sparkles,
  Layers,
  HardDrive,
  FileCheck,
  X,
  Plus,
} from "lucide-react";
import { PageHeader } from "@frontend/components/admin/PageHeader";
import {
  MetricCard,
  StatusBadge,
  EmptyState,
  LoadingSkeleton,
  ConfirmDialog,
  PrimaryButton,
  SecondaryButton,
  GoldButton,
} from "@frontend/components/admin/shared";
import { apiClient } from "@frontend/lib/api-client";

interface MediaItem {
  id: string;
  name: string;
  url: string;
  thumbnail_url: string;
  mime_type: string;
  size: number;
  folder: string;
  alt_text: string | null;
  width: number;
  height: number;
  is_webp_generated: boolean;
  is_avif_generated: boolean;
  responsive_variants?: any;
  blur_placeholder?: string | null;
  created_at: string;
}

interface MediaStats {
  total_count: number;
  total_size_bytes: number;
  webp_count: number;
  avif_count: number;
  folders: Array<{ folder: string; count: number }>;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function MediaLibraryPanel() {
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [stats, setStats] = useState<MediaStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Selection & Details
  const [activeItem, setActiveItem] = useState<MediaItem | null>(null);
  const [editingAlt, setEditingAlt] = useState<string>("");
  const [savingAlt, setSavingAlt] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFolder, setUploadFolder] = useState("uploads");
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete modal state
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Load Media and Stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const folderParam = selectedFolder !== "all" ? selectedFolder : undefined;
      const res = await (apiClient as any).getAdminMedia(folderParam);
      setMediaList(res?.media || []);

      // Fetch stats
      const statsRes = await fetch("/api/v1/admin/media/stats").then((r) => r.json());
      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.error("[MediaLibrary] Failed to load media:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedFolder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered list
  const filteredMedia = useMemo(() => {
    return mediaList.filter((item) => {
      if (searchQuery.trim() === "") return true;
      const q = searchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.alt_text && item.alt_text.toLowerCase().includes(q)) ||
        item.url.toLowerCase().includes(q)
      );
    });
  }, [mediaList, searchQuery]);

  // Copy URL handler
  const handleCopyUrl = (url: string, id: string) => {
    const fullUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedId(id);
    showToast("URL copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Save alt text
  const handleSaveAltText = async () => {
    if (!activeItem) return;
    setSavingAlt(true);
    try {
      await fetch(`/api/v1/admin/media/${activeItem.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alt_text: editingAlt }),
      });
      setActiveItem({ ...activeItem, alt_text: editingAlt });
      setMediaList((prev) =>
        prev.map((m) => (m.id === activeItem.id ? { ...m, alt_text: editingAlt } : m))
      );
      showToast("Alt text saved to database!");
    } catch (err) {
      console.error("Failed to update alt text:", err);
    } finally {
      setSavingAlt(false);
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];

    const validTypes = ["image/jpeg", "image/png", "image/webp", "image/avif"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Invalid image format. Allowed: JPG, PNG, WebP, AVIF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10MB limit.");
      return;
    }

    setSelectedFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPreviewDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Submit Upload
  const handleUploadSubmit = async () => {
    if (!previewDataUrl) {
      setUploadError("Please select an image file first.");
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const res: any = await (apiClient as any).uploadMedia({
        filename: selectedFileName,
        name: selectedFileName,
        dataUrl: previewDataUrl,
        folder: uploadFolder,
        alt_text: uploadAlt || selectedFileName,
      });

      if (res?.success) {
        showToast("Image processed (WebP/AVIF) and stored in PostgreSQL!");
        setShowUploadModal(false);
        setPreviewDataUrl(null);
        setSelectedFileName("");
        setUploadAlt("");
        loadData();
      } else {
        setUploadError(res?.error || "Upload failed.");
      }
    } catch (err: any) {
      setUploadError(err.message || "Failed to upload image.");
    } finally {
      setUploading(false);
    }
  };

  // Handle Delete
  const handleDeleteConfirm = async () => {
    if (!itemToDelete) return;
    setDeleting(true);
    try {
      await (apiClient as any).deleteAdminMedia(itemToDelete.id);
      showToast(`Deleted ${itemToDelete.name}`);
      setItemToDelete(null);
      if (activeItem?.id === itemToDelete.id) {
        setActiveItem(null);
      }
      loadData();
    } catch (err) {
      console.error("Failed to delete media:", err);
    } finally {
      setDeleting(false);
    }
  };

  // List of unique folders
  const folderOptions = useMemo(() => {
    const list = [
      "all",
      "products",
      "categories",
      "kitchen_story_desktop",
      "kitchen_story_mobile",
      "heroes",
      "banners",
      "branding",
      "uploads",
    ];
    return list;
  }, []);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 bg-brand-primary border border-brand-accent text-white px-5 py-3 rounded-lg shadow-2xl flex items-center gap-3 animate-fade-in">
          <Check className="w-5 h-5 text-brand-accent" />
          <span className="text-sm font-medium">{toastMsg}</span>
        </div>
      )}

      {/* Page Header */}
      <PageHeader
        icon={ImageIcon}
        title="Media Library & Pipeline"
        description="High-performance PostgreSQL-backed media catalog with automated Sharp WebP/AVIF compression, responsive variants, and LQIP placeholders."
        badge={<StatusBadge status="gold" label="PostgreSQL Synced" />}
        actions={
          <div className="flex items-center gap-3">
            <SecondaryButton icon={RefreshCw} onClick={loadData}>
              Refresh
            </SecondaryButton>
            <PrimaryButton icon={Upload} onClick={() => setShowUploadModal(true)}>
              Upload Image
            </PrimaryButton>
          </div>
        }
      />

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Media Assets"
          value={stats?.total_count ?? mediaList.length}
          icon={ImageIcon}
          subtitle="Indexed in PostgreSQL"
        />
        <MetricCard
          label="Total Storage"
          value={formatBytes(stats?.total_size_bytes ?? 0)}
          icon={HardDrive}
          subtitle="Optimized bundle size"
        />
        <MetricCard
          label="WebP Generated"
          value={stats?.webp_count ?? 0}
          icon={Sparkles}
          subtitle="Modern web format"
        />
        <MetricCard
          label="Active Folders"
          value={stats?.folders?.length ?? 8}
          icon={Layers}
          subtitle="Categorized taxonomy"
        />
      </div>

      {/* Folder Navigation Tabs & Search Toolbar */}
      <div className="bg-admin-card-bg border border-admin-card-border rounded-xl p-4 shadow-sm space-y-4">
        {/* Folder Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {folderOptions.map((f) => {
            const isSelected = selectedFolder === f;
            const folderStat = stats?.folders?.find((item) => item.folder === f);
            const count = f === "all" ? stats?.total_count ?? mediaList.length : folderStat?.count ?? 0;

            return (
              <button
                key={f}
                onClick={() => setSelectedFolder(f)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isSelected
                    ? "bg-brand-primary text-brand-accent shadow-sm border border-brand-accent/40"
                    : "text-admin-text-secondary hover:text-admin-text-primary hover:bg-admin-content-bg"
                }`}
              >
                <Folder className="w-3.5 h-3.5" />
                <span className="capitalize">{f.replace(/_/g, " ")}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isSelected ? "bg-brand-accent/20 text-brand-accent" : "bg-admin-card-border text-admin-text-muted"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search + View Mode Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-admin-card-border">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-admin-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search images by name, alt text, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-admin-content-bg border border-admin-card-border rounded-lg text-admin-text-primary focus:outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <span className="text-xs text-admin-text-muted">
              Showing {filteredMedia.length} of {mediaList.length} items
            </span>
            <div className="flex items-center bg-admin-content-bg border border-admin-card-border rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md ${
                  viewMode === "grid" ? "bg-brand-primary text-brand-accent" : "text-admin-text-muted hover:text-admin-text-primary"
                }`}
                title="Grid View"
              >
                <Grid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md ${
                  viewMode === "list" ? "bg-brand-primary text-brand-accent" : "text-admin-text-muted hover:text-admin-text-primary"
                }`}
                title="List View"
              >
                <ListIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area: Grid or List */}
      {loading ? (
        <LoadingSkeleton />
      ) : filteredMedia.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="No media assets found"
          description="Try changing the folder filter, search term, or upload a new image."
          action={
            <PrimaryButton icon={Upload} onClick={() => setShowUploadModal(true)}>
              Upload First Image
            </PrimaryButton>
          }
        />
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {filteredMedia.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setActiveItem(item);
                setEditingAlt(item.alt_text || "");
              }}
              className="group bg-admin-card-bg border border-admin-card-border hover:border-brand-accent/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              {/* Thumbnail image */}
              <div className="relative aspect-square w-full bg-admin-content-bg flex items-center justify-center overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnail_url || item.url}
                  alt={item.alt_text || item.name}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  onError={(e: any) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587";
                  }}
                />

                {/* Badges on image */}
                <div className="absolute top-2 left-2 flex flex-col gap-1">
                  {item.is_webp_generated && (
                    <span className="bg-emerald-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      WebP
                    </span>
                  )}
                  {item.is_avif_generated && (
                    <span className="bg-indigo-500/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                      AVIF
                    </span>
                  )}
                </div>

                {/* Hover overlay actions */}
                <div className="absolute inset-0 bg-brand-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopyUrl(item.url, item.id);
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors"
                    title="Copy URL"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveItem(item);
                      setEditingAlt(item.alt_text || "");
                    }}
                    className="p-1.5 bg-white/20 hover:bg-white/40 text-white rounded-lg backdrop-blur-sm transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setItemToDelete(item);
                    }}
                    className="p-1.5 bg-rose-500/80 hover:bg-rose-500 text-white rounded-lg backdrop-blur-sm transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Metadata */}
              <div className="p-2.5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-medium text-admin-text-primary truncate" title={item.name}>
                    {item.name}
                  </h4>
                  <p className="text-[10px] text-admin-text-muted truncate capitalize">
                    {item.folder}
                  </p>
                </div>
                <div className="flex items-center justify-between text-[10px] text-admin-text-muted mt-2 pt-1 border-t border-admin-card-border">
                  <span>{item.width && item.height ? `${item.width}×${item.height}` : "Auto"}</span>
                  <span>{formatBytes(item.size)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* List View */
        <div className="bg-admin-card-bg border border-admin-card-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="bg-admin-content-bg border-b border-admin-card-border text-admin-text-muted font-medium">
              <tr>
                <th className="p-3">Preview</th>
                <th className="p-3">File Name</th>
                <th className="p-3">Folder</th>
                <th className="p-3">Alt Text</th>
                <th className="p-3">Dimensions</th>
                <th className="p-3">Size</th>
                <th className="p-3">Optimizations</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-card-border">
              {filteredMedia.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => {
                    setActiveItem(item);
                    setEditingAlt(item.alt_text || "");
                  }}
                  className="hover:bg-admin-content-bg/50 transition-colors cursor-pointer"
                >
                  <td className="p-3">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-admin-content-bg flex-shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail_url || item.url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        onError={(e: any) => {
                          e.currentTarget.src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587";
                        }}
                      />
                    </div>
                  </td>
                  <td className="p-3 font-medium text-admin-text-primary max-w-[180px] truncate">
                    {item.name}
                  </td>
                  <td className="p-3 capitalize text-admin-text-secondary">{item.folder}</td>
                  <td className="p-3 text-admin-text-muted max-w-[200px] truncate">
                    {item.alt_text || <span className="italic text-amber-500/80">Missing alt text</span>}
                  </td>
                  <td className="p-3 text-admin-text-muted">
                    {item.width && item.height ? `${item.width}×${item.height}` : "Auto"}
                  </td>
                  <td className="p-3 text-admin-text-muted">{formatBytes(item.size)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      {item.is_webp_generated && <StatusBadge status="active" label="WebP" />}
                      {item.is_avif_generated && <StatusBadge status="info" label="AVIF" />}
                      {!item.is_webp_generated && !item.is_avif_generated && (
                        <span className="text-[10px] text-admin-text-muted">Standard</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleCopyUrl(item.url, item.id)}
                        className="p-1.5 text-admin-text-muted hover:text-brand-accent rounded hover:bg-admin-card-bg transition-colors"
                        title="Copy URL"
                      >
                        {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => setItemToDelete(item)}
                        className="p-1.5 text-admin-text-muted hover:text-rose-400 rounded hover:bg-admin-card-bg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Details / Edit Modal */}
      {activeItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-card-bg border border-admin-card-border rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-admin-card-border">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-brand-accent" />
                <h3 className="text-sm font-semibold text-admin-text-primary truncate">
                  {activeItem.name}
                </h3>
              </div>
              <button
                onClick={() => setActiveItem(null)}
                className="text-admin-text-muted hover:text-admin-text-primary p-1 rounded-lg hover:bg-admin-content-bg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Big Preview */}
              <div className="rounded-xl overflow-hidden bg-admin-content-bg border border-admin-card-border flex items-center justify-center max-h-72">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeItem.url}
                  alt={activeItem.alt_text || activeItem.name}
                  className="max-h-72 w-auto object-contain"
                  onError={(e: any) => {
                    e.currentTarget.src = "https://images.unsplash.com/photo-1578985545062-69928b1d9587";
                  }}
                />
              </div>

              {/* Details & Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-admin-content-bg p-2.5 rounded-lg border border-admin-card-border">
                  <span className="text-admin-text-muted block text-[10px]">Folder</span>
                  <span className="font-semibold text-admin-text-primary capitalize">{activeItem.folder}</span>
                </div>
                <div className="bg-admin-content-bg p-2.5 rounded-lg border border-admin-card-border">
                  <span className="text-admin-text-muted block text-[10px]">Dimensions</span>
                  <span className="font-semibold text-admin-text-primary">
                    {activeItem.width && activeItem.height ? `${activeItem.width} × ${activeItem.height}` : "Auto"}
                  </span>
                </div>
                <div className="bg-admin-content-bg p-2.5 rounded-lg border border-admin-card-border">
                  <span className="text-admin-text-muted block text-[10px]">File Size</span>
                  <span className="font-semibold text-admin-text-primary">{formatBytes(activeItem.size)}</span>
                </div>
                <div className="bg-admin-content-bg p-2.5 rounded-lg border border-admin-card-border">
                  <span className="text-admin-text-muted block text-[10px]">MIME Type</span>
                  <span className="font-semibold text-admin-text-primary">{activeItem.mime_type}</span>
                </div>
              </div>

              {/* Alt Text Editor (Crucial for SEO) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-admin-text-primary flex items-center justify-between">
                  <span>SEO Alt Text (Accessibility & Search Ranking)</span>
                  {activeItem.alt_text ? (
                    <span className="text-[10px] text-emerald-400">Configured</span>
                  ) : (
                    <span className="text-[10px] text-amber-400">Missing — Needs Alt Text</span>
                  )}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingAlt}
                    onChange={(e) => setEditingAlt(e.target.value)}
                    placeholder="Descriptive text for visually impaired users and image search..."
                    className="flex-1 px-3 py-2 text-xs bg-admin-content-bg border border-admin-card-border rounded-lg text-admin-text-primary focus:outline-none focus:border-brand-accent"
                  />
                  <PrimaryButton onClick={handleSaveAltText} disabled={savingAlt}>
                    {savingAlt ? "Saving..." : "Save"}
                  </PrimaryButton>
                </div>
              </div>

              {/* URLs and Links */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-admin-text-primary">Asset URL</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={activeItem.url}
                    className="flex-1 px-3 py-2 text-xs bg-admin-content-bg border border-admin-card-border rounded-lg text-admin-text-muted"
                  />
                  <SecondaryButton
                    icon={copiedId === activeItem.id ? Check : Copy}
                    onClick={() => handleCopyUrl(activeItem.url, activeItem.id)}
                  >
                    {copiedId === activeItem.id ? "Copied" : "Copy"}
                  </SecondaryButton>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-admin-card-border">
                <button
                  onClick={() => {
                    setItemToDelete(activeItem);
                  }}
                  className="flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Asset
                </button>
                <SecondaryButton onClick={() => setActiveItem(null)}>Close</SecondaryButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-admin-card-bg border border-admin-card-border rounded-2xl max-w-lg w-full shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-admin-card-border pb-3">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-brand-accent" />
                <h3 className="text-sm font-semibold text-admin-text-primary">
                  Upload & Transcode Media
                </h3>
              </div>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-admin-text-muted hover:text-admin-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {uploadError && (
              <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 px-3 py-2 rounded-lg text-xs">
                {uploadError}
              </div>
            )}

            {/* Dropzone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-admin-card-border hover:border-brand-accent/50 rounded-xl p-6 text-center cursor-pointer bg-admin-content-bg/50 hover:bg-admin-content-bg transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={handleFileSelect}
                className="hidden"
              />
              {previewDataUrl ? (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewDataUrl} alt="Preview" className="h-32 w-auto object-contain rounded-lg" />
                  <span className="text-xs font-medium text-admin-text-primary">{selectedFileName}</span>
                  <span className="text-[10px] text-brand-accent">Click to change file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-admin-text-muted">
                  <div className="w-12 h-12 rounded-full bg-brand-primary/20 flex items-center justify-center text-brand-accent">
                    <Upload className="w-6 h-6" />
                  </div>
                  <span className="text-xs font-semibold text-admin-text-primary">
                    Click to select or drag & drop image
                  </span>
                  <span className="text-[10px]">
                    Supported: JPG, PNG, WebP, AVIF (Max 10MB). Automatically generates WebP, AVIF, and thumbnails.
                  </span>
                </div>
              )}
            </div>

            {/* Folder & Alt Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-admin-text-primary block mb-1">Target Folder</label>
                <select
                  value={uploadFolder}
                  onChange={(e) => setUploadFolder(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-admin-content-bg border border-admin-card-border rounded-lg text-admin-text-primary capitalize focus:outline-none focus:border-brand-accent"
                >
                  <option value="products">Products</option>
                  <option value="categories">Categories</option>
                  <option value="heroes">Heroes</option>
                  <option value="banners">Banners</option>
                  <option value="kitchen_story_desktop">Kitchen Story Desktop</option>
                  <option value="kitchen_story_mobile">Kitchen Story Mobile</option>
                  <option value="branding">Branding</option>
                  <option value="uploads">Uploads</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-admin-text-primary block mb-1">
                  Alt Text (for SEO)
                </label>
                <input
                  type="text"
                  value={uploadAlt}
                  onChange={(e) => setUploadAlt(e.target.value)}
                  placeholder="e.g. Chocolate Truffle Cake Birthday Special"
                  className="w-full px-3 py-2 text-xs bg-admin-content-bg border border-admin-card-border rounded-lg text-admin-text-primary focus:outline-none focus:border-brand-accent"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-admin-card-border">
              <SecondaryButton onClick={() => setShowUploadModal(false)}>Cancel</SecondaryButton>
              <PrimaryButton onClick={handleUploadSubmit} disabled={uploading || !previewDataUrl}>
                {uploading ? "Processing Sharp Pipeline..." : "Upload & Optimize"}
              </PrimaryButton>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={!!itemToDelete}
        title="Delete Media Asset"
        message={`Are you sure you want to delete "${itemToDelete?.name}"? This will soft-delete the record in PostgreSQL.`}
        confirmLabel={deleting ? "Deleting..." : "Delete Asset"}
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
}
