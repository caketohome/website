"use client";

import { useState, useEffect, useRef } from "react";
import { Heading, Text, Badge, Button, Input, Label } from "@medusajs/ui";
import { apiClient } from "@frontend/lib/api-client";
import {
  Upload, Image as ImageIcon, Link as LinkIcon, Check,
  XCircle, Trash2, Search, AlertCircle, RefreshCw, Eye
} from "lucide-react";

export interface MediaSelection {
  media_id?: string;
  url: string;
  alt: string;
  name?: string;
  width?: number;
  height?: number;
}

interface MediaSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (selection: MediaSelection) => void;
  currentValue?: {
    media_id?: string;
    url?: string;
    alt?: string;
  };
  title?: string;
}

export function MediaSelectorModal({
  isOpen,
  onClose,
  onSelect,
  currentValue,
  title = "Select or Upload Image",
}: MediaSelectorModalProps) {
  const [activeTab, setActiveTab] = useState<"library" | "upload" | "url">("library");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MediaSelection>({
    media_id: currentValue?.media_id || "",
    url: currentValue?.url || "",
    alt: currentValue?.alt || "",
  });
  const [urlInput, setUrlInput] = useState(currentValue?.url || "");
  const [altInput, setAltInput] = useState(currentValue?.alt || "");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      loadMedia();
      setSelectedItem({
        media_id: currentValue?.media_id || "",
        url: currentValue?.url || "",
        alt: currentValue?.alt || "",
      });
      setUrlInput(currentValue?.url || "");
      setAltInput(currentValue?.alt || "");
      setUploadError(null);
    }
  }, [isOpen, currentValue]);

  const loadMedia = async () => {
    setLoading(true);
    try {
      const res: any = await apiClient.getAdminMedia();
      setMediaList(res?.media || []);
    } catch {
      setMediaList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    // Validate type (strictly secure formats only - JPEG, PNG, WebP, AVIF)
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
    if (!validTypes.includes(file.type)) {
      setUploadError("Invalid format. Please upload JPEG, PNG, WebP, or AVIF (SVG & scripts are prohibited for security).");
      return;
    }

    // Validate size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File is too large. Maximum allowed size is 10 MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        try {
          const res: any = await apiClient.uploadMedia({
            name: file.name.replace(/\.[^/.]+$/, ""),
            filename: file.name,
            dataUrl,
            mime_type: file.type,
            size: file.size,
            alt_text: altInput || file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " "),
          });

          const uploadedMedia = res?.media;
          if (uploadedMedia) {
            await loadMedia();
            setSelectedItem({
              media_id: uploadedMedia.id,
              url: uploadedMedia.url,
              alt: uploadedMedia.alt_text || altInput || "",
              name: uploadedMedia.name,
            });
            setAltInput(uploadedMedia.alt_text || "");
            setActiveTab("library");
          }
        } catch (err: any) {
          setUploadError(err.message || "Failed to upload file");
        } finally {
          setUploading(false);
        }
      };
      reader.onerror = () => {
        setUploadError("Failed to read file from disk");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setUploadError(err.message || "Upload error");
      setUploading(false);
    }
  };

  const handleDeleteMedia = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Delete this image from media library?")) return;
    try {
      await apiClient.deleteAdminMedia(id);
      await loadMedia();
      if (selectedItem.media_id === id) {
        setSelectedItem({ media_id: "", url: "", alt: "" });
      }
    } catch {
      // ignore
    }
  };

  const handleApply = () => {
    let finalUrl = selectedItem.url;
    if (activeTab === "url" && urlInput.trim()) {
      finalUrl = urlInput.trim();
    }
    onSelect({
      media_id: selectedItem.media_id || undefined,
      url: finalUrl,
      alt: altInput.trim() || selectedItem.alt || "",
      name: selectedItem.name,
      width: selectedItem.width,
      height: selectedItem.height,
    });
    onClose();
  };

  const handleClear = () => {
    onSelect({
      media_id: undefined,
      url: "",
      alt: "",
    });
    onClose();
  };

  if (!isOpen) return null;

  const filteredMedia = mediaList.filter(
    (m) =>
      m.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.alt_text?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-ui-border-base flex items-center justify-between bg-ui-bg-subtle/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-rose-500 text-white rounded-lg shadow-sm">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <Heading level="h3" className="text-sm font-bold">{title}</Heading>
              <Text className="text-[11px] text-ui-fg-muted">Choose an image from library, upload a new photo, or provide a URL</Text>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-ui-fg-muted hover:bg-ui-bg-subtle">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-2 px-4 pt-3 border-b border-ui-border-base bg-ui-bg-base">
          <button
            type="button"
            onClick={() => setActiveTab("library")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "library"
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Media Library ({mediaList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "upload"
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Upload className="w-3.5 h-3.5" /> Upload File
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("url")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "url"
                ? "border-rose-500 text-rose-600 dark:text-rose-400"
                : "border-transparent text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" /> External URL
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* TAB 1: Media Library */}
          {activeTab === "library" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ui-fg-muted" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search images by name or ALT text..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-ui-bg-subtle border border-ui-border-base rounded-lg outline-none focus:ring-1 focus:ring-rose-400"
                  />
                </div>
                <Button variant="secondary" size="small" onClick={loadMedia} isLoading={loading}>
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                </Button>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <div key={i} className="aspect-video bg-ui-bg-subtle animate-pulse rounded-xl" />
                  ))}
                </div>
              ) : filteredMedia.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-ui-border-base rounded-xl">
                  <ImageIcon className="w-10 h-10 text-ui-fg-muted mx-auto mb-2 opacity-50" />
                  <Text className="text-xs text-ui-fg-muted">No media found. Upload an image to get started.</Text>
                  <Button variant="secondary" size="small" className="mt-3" onClick={() => setActiveTab("upload")}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Upload Image
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-72 overflow-y-auto pr-1">
                  {filteredMedia.map((media) => {
                    const isSelected = selectedItem.url === media.url || selectedItem.media_id === media.id;
                    return (
                      <div
                        key={media.id}
                        onClick={() => {
                          setSelectedItem({
                            media_id: media.id,
                            url: media.url,
                            alt: media.alt_text || altInput || "",
                            name: media.name,
                            width: media.width,
                            height: media.height,
                          });
                          if (media.alt_text) setAltInput(media.alt_text);
                        }}
                        className={`group relative aspect-video bg-ui-bg-subtle rounded-xl overflow-hidden cursor-pointer border-2 transition-all flex flex-col justify-between ${
                          isSelected
                            ? "border-rose-500 shadow-md ring-2 ring-rose-300"
                            : "border-ui-border-base hover:border-ui-border-strong hover:shadow-sm"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={media.thumbnail_url || media.url}
                          alt={media.alt_text || media.name || ""}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                        {isSelected && (
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center shadow">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-white flex items-center justify-between opacity-90">
                          <span className="text-[10px] font-medium truncate max-w-[120px]">{media.name || media.filename}</span>
                          <button
                            onClick={(e) => handleDeleteMedia(media.id, e)}
                            className="p-1 rounded text-white/80 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete image"
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
          )}

          {/* TAB 2: Upload */}
          {activeTab === "upload" && (
            <div className="flex flex-col gap-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFileChange(e.dataTransfer.files);
                }}
                className="border-2 border-dashed border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/10 rounded-2xl p-8 text-center cursor-pointer hover:bg-rose-50/70 transition-all flex flex-col items-center justify-center gap-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => handleFileChange(e.target.files)}
                  accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
                  className="hidden"
                />
                <div className="p-3 bg-white dark:bg-ui-bg-base text-rose-500 rounded-full shadow-sm">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <Text className="text-xs font-bold text-ui-fg-base">Click to upload or drag &amp; drop</Text>
                  <Text className="text-[11px] text-ui-fg-muted mt-0.5">JPEG, PNG, WebP, AVIF up to 10 MB</Text>
                </div>
                {uploading && (
                  <div className="flex items-center gap-2 text-xs font-semibold text-rose-600 animate-pulse mt-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Uploading image to storage...
                  </div>
                )}
              </div>
              {uploadError && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" /> {uploadError}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: External URL */}
          {activeTab === "url" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold">Image URL (HTTPS)</Label>
                <Input
                  type="url"
                  value={urlInput}
                  onChange={(e) => {
                    setUrlInput(e.target.value);
                    setSelectedItem((prev) => ({ ...prev, url: e.target.value }));
                  }}
                  placeholder="Upload an image (stored in S3)"
                />
                <Text className="text-[10px] text-ui-fg-muted">Provide a direct image URL accessible publicly</Text>
              </div>
              {urlInput && (
                <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urlInput}
                    alt={altInput || "Preview"}
                    className="w-20 h-14 object-cover rounded-lg shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = "none";
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <Text className="text-xs font-semibold truncate">{urlInput}</Text>
                    <Text className="text-[10px] text-emerald-600 flex items-center gap-1 mt-0.5">
                      <Check className="w-3 h-3" /> URL linked
                    </Text>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ALT Text Configuration & Preview Box */}
          <div className="border-t border-ui-border-base pt-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <span>Image ALT Text (Accessibility &amp; SEO)</span>
                  {altInput.trim() ? (
                    <Badge color="green" className="text-[9px] px-1 py-0">✓ Valid</Badge>
                  ) : (
                    <Badge color="orange" className="text-[9px] px-1 py-0">⚠ Missing ALT</Badge>
                  )}
                </Label>
                <span className="text-[10px] text-ui-fg-muted tabular-nums">{altInput.length}/120</span>
              </div>
              <Input
                value={altInput}
                onChange={(e) => {
                  setAltInput(e.target.value);
                  setSelectedItem((prev) => ({ ...prev, alt: e.target.value }));
                }}
                placeholder="Descriptive explanation of the image for screen readers and search engines"
              />
            </div>

            {/* Current Selection Bar */}
            {(selectedItem.url || urlInput) && (
              <div className="p-3 bg-rose-50/60 dark:bg-rose-950/20 rounded-xl border border-rose-200/60 dark:border-rose-900/30 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selectedItem.url || urlInput}
                  alt={altInput || "Preview"}
                  className="w-16 h-12 object-cover rounded-lg shrink-0 border border-ui-border-base"
                />
                <div className="flex-1 min-w-0">
                  <Text className="text-xs font-bold text-ui-fg-base truncate">{selectedItem.name || "Selected Image"}</Text>
                  <Text className="text-[10px] text-ui-fg-muted font-mono truncate">{selectedItem.url || urlInput}</Text>
                  <Text className="text-[10px] text-rose-700 dark:text-rose-400 font-medium truncate">
                    ALT: {altInput || <span className="italic text-brand-gold">None</span>}
                  </Text>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-ui-border-base bg-ui-bg-subtle/40 flex items-center justify-between">
          <Button variant="secondary" size="small" onClick={handleClear} className="text-red-500 hover:text-red-700">
            Remove Image
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="small" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="small"
              onClick={handleApply}
              disabled={!selectedItem.url && !urlInput}
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Apply Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
