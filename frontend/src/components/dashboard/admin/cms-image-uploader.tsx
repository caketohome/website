"use client";

import React, { useState, useRef, useEffect } from "react";
import { Heading, Text, Badge, Button, Input, Label, Select } from "@medusajs/ui";
import {
  Upload, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2,
  AlertCircle, Link as LinkIcon, FolderOpen, Eye, Check, X, ShieldAlert,
  Smartphone, Tablet, Monitor
} from "lucide-react";
import { compressImageToWebP } from "@frontend/lib/util/image-compressor";
import { apiClient } from "@frontend/lib/api-client";
import { MediaSelection } from "./media-selector-modal";

export interface CmsImageValue {
  image_url?: string;
  tablet_image_url?: string;
  mobile_image_url?: string;
  image_alt?: string;
  image_fit?: "cover" | "contain";
  image_position_align?: "center" | "top" | "bottom" | "left" | "right";
  use_desktop_fallback?: boolean;
  media_id?: string;
}

interface CmsImageUploaderProps {
  label?: string;
  sectionId: string;
  config: Record<string, any>;
  updateConfig: (key: string, value: any) => void;
  openImagePicker?: (title: string, current: any, onSelect: (sel: MediaSelection) => void) => void;
  headingFallback?: string;
}

export function CmsImageUploader({
  label = "Kitchen Story Image",
  sectionId,
  config,
  updateConfig,
  openImagePicker,
  headingFallback = "Kitchen Story",
}: CmsImageUploaderProps) {
  const [deviceTab, setDeviceTab] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"IDLE" | "UPLOADING" | "PROCESSING" | "READY" | "FAILED">("IDLE");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Metadata of the currently active image
  const [imageMeta, setImageMeta] = useState<{
    filename: string;
    dimensions: string;
    sizeKb: number;
    format: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Active URL based on current device tab
  const getActiveUrl = () => {
    if (deviceTab === "tablet") return config.tablet_image_url || config.tablet_image?.url || "";
    if (deviceTab === "mobile") return config.mobile_image_url || config.mobile_image?.url || "";
    return config.image_url || config.desktop_image_url || config.bg_image || config.desktop_image?.url || "";
  };

  const currentUrl = getActiveUrl();
  const desktopUrl = config.image_url || config.desktop_image_url || "";
  const useFallback = config.use_desktop_fallback !== false;

  // Inspect image dimensions and format whenever URL changes
  useEffect(() => {
    if (!currentUrl) {
      setImageMeta(null);
      return;
    }

    let isMounted = true;
    const img = new window.Image();
    img.onload = () => {
      if (!isMounted) return;
      const rawName = currentUrl.split("/").pop()?.split("?")[0] || "image.webp";
      const ext = rawName.split(".").pop()?.toUpperCase() || "WEBP";
      setImageMeta({
        filename: decodeURIComponent(rawName),
        dimensions: `${img.naturalWidth || img.width} × ${img.naturalHeight || img.height} px`,
        sizeKb: currentUrl.startsWith("data:") ? Math.round((currentUrl.length * 0.75) / 1024) : 0,
        format: ext.length <= 4 ? ext : "IMAGE",
      });
    };
    img.onerror = () => {
      if (!isMounted) return;
      setImageMeta({
        filename: currentUrl.split("/").pop()?.split("?")[0] || "image.webp",
        dimensions: "External Image",
        sizeKb: 0,
        format: "URL",
      });
    };
    img.src = currentUrl;

    return () => {
      isMounted = false;
    };
  }, [currentUrl]);

  // File Upload & Compression Handler
  const handleFile = async (file: File) => {
    setErrorMessage(null);

    // 1. Strict Format Validation
    const allowedMimes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
    const lowerType = (file.type || "").toLowerCase();
    const rawExt = file.name.split(".").pop()?.toLowerCase() || "";

    if (
      lowerType.includes("svg") ||
      lowerType.includes("xml") ||
      lowerType.includes("html") ||
      rawExt === "svg"
    ) {
      setUploadStatus("FAILED");
      setErrorMessage("SVG format is strictly prohibited for security. Please upload JPG, PNG, or WebP.");
      return;
    }

    if (!allowedMimes.includes(lowerType) && !["jpg", "jpeg", "png", "webp", "avif"].includes(rawExt)) {
      setUploadStatus("FAILED");
      setErrorMessage("Unsupported format. Allowed formats: JPG, JPEG, PNG, WEBP, AVIF.");
      return;
    }

    // 2. Max File Size Validation (10 MB)
    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setUploadStatus("FAILED");
      setErrorMessage("File exceeds 10 MB limit. Please choose a smaller original image.");
      return;
    }

    setUploadStatus("UPLOADING");
    setUploadProgress(25);

    try {
      // 3. Client-Side Image Optimization & WebP Conversion
      setUploadProgress(45);
      const compressedDataUrl = await compressImageToWebP(file, {
        maxWidth: deviceTab === "mobile" ? 828 : deviceTab === "tablet" ? 1280 : 1920,
        maxHeight: deviceTab === "mobile" ? 1792 : deviceTab === "tablet" ? 800 : 1080,
        quality: 0.85,
        maxSizeBytes: 800 * 1024,
      });

      setUploadStatus("PROCESSING");
      setUploadProgress(70);

      // 4. Send to Canonical Media API
      const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ");
      const uploadRes: any = await apiClient.uploadMedia({
        name: `${headingFallback} — ${cleanName}`,
        filename: file.name.replace(/\.[^/.]+$/, ".webp"),
        dataUrl: compressedDataUrl,
        mime_type: "image/webp",
        size: Math.round(compressedDataUrl.length * 0.75),
        alt_text: config.image_alt || `${headingFallback} illustration`,
        folder: "kitchen_story",
        width: 1920,
        height: 1080,
      });

      const canonicalUrl = uploadRes?.url || uploadRes?.media?.url || compressedDataUrl;
      const mediaId = uploadRes?.media?.id || "";

      // 5. Update CMS Section Configuration for Active Device
      if (deviceTab === "tablet") {
        updateConfig("tablet_image_url", canonicalUrl);
      } else if (deviceTab === "mobile") {
        updateConfig("mobile_image_url", canonicalUrl);
      } else {
        updateConfig("image_url", canonicalUrl);
        updateConfig("desktop_image_url", canonicalUrl);
        updateConfig("bg_image", canonicalUrl);
      }

      if (mediaId) {
        updateConfig("media_id", mediaId);
      }

      if (!config.image_alt) {
        updateConfig("image_alt", cleanName);
      }

      setUploadProgress(100);
      setUploadStatus("READY");
      setTimeout(() => setUploadStatus("IDLE"), 3000);
    } catch (err: any) {
      console.error("[Kitchen Story Image Upload Error]:", err);
      setUploadStatus("FAILED");
      setErrorMessage(err?.message || "Upload failed. Your existing image has been preserved.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleRemove = () => {
    if (!confirm("Are you sure you want to remove this image from the section?")) return;
    if (deviceTab === "tablet") {
      updateConfig("tablet_image_url", "");
    } else if (deviceTab === "mobile") {
      updateConfig("mobile_image_url", "");
    } else {
      updateConfig("image_url", "");
      updateConfig("desktop_image_url", "");
      updateConfig("bg_image", "");
      updateConfig("media_id", "");
    }
    setImageMeta(null);
  };

  const handleSelectFromLibrary = () => {
    if (!openImagePicker) return;
    openImagePicker(
      `Select ${deviceTab.toUpperCase()} Kitchen Story Image`,
      { url: currentUrl, alt: config.image_alt || "" },
      (sel: MediaSelection) => {
        if (deviceTab === "tablet") {
          updateConfig("tablet_image_url", sel.url);
        } else if (deviceTab === "mobile") {
          updateConfig("mobile_image_url", sel.url);
        } else {
          updateConfig("image_url", sel.url);
          updateConfig("desktop_image_url", sel.url);
          updateConfig("bg_image", sel.url);
        }
        if (sel.media_id) updateConfig("media_id", sel.media_id);
        if (sel.alt && !config.image_alt) updateConfig("image_alt", sel.alt);
      }
    );
  };

  return (
    <div className="flex flex-col gap-3 p-3.5 bg-ui-bg-subtle rounded-2xl border border-ui-border-base">
      {/* Header & Device Selection */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <ImageIcon className="w-4 h-4 text-rose-500" />
          <Label className="text-xs font-bold text-ui-fg-base">{label}</Label>
        </div>
        <div className="flex bg-ui-bg-base rounded-lg p-0.5 border border-ui-border-base">
          <button
            type="button"
            onClick={() => setDeviceTab("desktop")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              deviceTab === "desktop" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Monitor className="w-3 h-3" /> Desktop
          </button>
          <button
            type="button"
            onClick={() => setDeviceTab("tablet")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              deviceTab === "tablet" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Tablet className="w-3 h-3" /> Tablet
          </button>
          <button
            type="button"
            onClick={() => setDeviceTab("mobile")}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
              deviceTab === "mobile" ? "bg-rose-500 text-white shadow-sm" : "text-ui-fg-muted hover:text-ui-fg-base"
            }`}
          >
            <Smartphone className="w-3 h-3" /> Mobile
          </button>
        </div>
      </div>

      {/* Fallback Notice for Tablet/Mobile */}
      {deviceTab !== "desktop" && !currentUrl && useFallback && desktopUrl && (
        <div className="p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-xl border border-blue-200/40 text-[11px] text-blue-600 flex items-center justify-between">
          <span>Using <strong>Desktop Image</strong> as automatic fallback.</span>
          <Button variant="secondary" size="small" onClick={() => fileInputRef.current?.click()} className="text-[10px] h-6 px-2">
            Upload Device Specific
          </Button>
        </div>
      )}

      {/* ── 1. ACTIVE IMAGE PREVIEW CARD ── */}
      {currentUrl ? (
        <div className="flex flex-col gap-2.5 bg-ui-bg-base p-3 rounded-xl border border-ui-border-base shadow-sm">
          <div className="flex gap-3 items-center">
            <div className="relative w-24 h-20 rounded-lg overflow-hidden border border-ui-border-base shrink-0 bg-ui-bg-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentUrl}
                alt={config.image_alt || "Kitchen Story Preview"}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <Text className="text-xs font-semibold text-ui-fg-base truncate max-w-[180px]">
                  {imageMeta?.filename || "kitchen-story-image.webp"}
                </Text>
                {imageMeta?.format && (
                  <Badge color="purple" className="text-[9px] px-1.5 py-0">
                    {imageMeta.format}
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-[10px] text-ui-fg-muted">
                {imageMeta?.dimensions && <span>{imageMeta.dimensions}</span>}
                {imageMeta?.sizeKb ? <span>• {imageMeta.sizeKb} KB</span> : null}
              </div>

              <div className="flex items-center gap-1.5 pt-1">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-[11px] h-7 px-2.5 font-medium"
                >
                  <RefreshCw className="w-3 h-3 mr-1" /> Replace Image
                </Button>
                {openImagePicker && (
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={handleSelectFromLibrary}
                    className="text-[11px] h-7 px-2 font-medium"
                  >
                    <FolderOpen className="w-3 h-3" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleRemove}
                  className="text-[11px] h-7 px-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── 2. DRAG & DROP ZONE ── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
            isDragging
              ? "border-rose-500 bg-rose-50/20"
              : "border-ui-border-base hover:border-rose-400 bg-ui-bg-base/60"
          }`}
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-2">
            <Upload className="w-5 h-5 text-rose-500" />
          </div>
          <Text className="text-xs font-semibold text-ui-fg-base text-center">
            Drop image here or click to upload
          </Text>
          <Text className="text-[10px] text-ui-fg-muted text-center mt-0.5">
            Supported formats: JPG, PNG, WebP, AVIF (Max 10 MB)
          </Text>

          {openImagePicker && (
            <div className="mt-3" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="secondary"
                size="small"
                onClick={handleSelectFromLibrary}
                className="text-[11px] h-6 px-2.5"
              >
                <FolderOpen className="w-3 h-3 mr-1 text-purple-600" /> Choose from Media Library
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
          e.target.value = "";
        }}
        className="hidden"
      />

      {/* Upload & Progress Status */}
      {uploadStatus !== "IDLE" && (
        <div className="flex flex-col gap-1.5 p-2 bg-ui-bg-base rounded-xl border border-ui-border-base text-xs">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-semibold text-ui-fg-base flex items-center gap-1.5">
              {uploadStatus === "UPLOADING" && <RefreshCw className="w-3 h-3 animate-spin text-rose-500" />}
              {uploadStatus === "PROCESSING" && <RefreshCw className="w-3 h-3 animate-spin text-amber-500" />}
              {uploadStatus === "READY" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              {uploadStatus === "FAILED" && <AlertCircle className="w-3 h-3 text-red-500" />}
              {uploadStatus === "UPLOADING" && `Uploading image... ${uploadProgress}%`}
              {uploadStatus === "PROCESSING" && "Processing & optimizing image..."}
              {uploadStatus === "READY" && "Image uploaded successfully."}
              {uploadStatus === "FAILED" && "Upload failed. Your existing image has been preserved."}
            </span>
            <span className="text-ui-fg-muted">{uploadProgress}%</span>
          </div>

          <div className="w-full bg-ui-bg-subtle h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${
                uploadStatus === "FAILED" ? "bg-red-500" : "bg-rose-500"
              }`}
              style={{ width: `${uploadProgress}%` }}
            />
          </div>

          {errorMessage && (
            <p className="text-[11px] text-red-600 mt-0.5">{errorMessage}</p>
          )}
        </div>
      )}

      {/* Alt Text & Presentation Settings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <div className="flex flex-col gap-1 sm:col-span-2">
          <Label className="text-[11px] font-semibold text-ui-fg-base">Alt Text (Accessibility)</Label>
          <Input
            value={config.image_alt || ""}
            onChange={(e) => updateConfig("image_alt", e.target.value)}
            placeholder="e.g., Master chef glazing handcrafted Belgian chocolate truffle cake"
            className="text-xs"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-semibold text-ui-fg-base">Object Fit</Label>
          <Select
            value={config.image_fit || "cover"}
            onValueChange={(v) => updateConfig("image_fit", v)}
          >
            <Select.Trigger className="text-xs h-8">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="cover">Cover (Fill & Crop)</Select.Item>
              <Select.Item value="contain">Contain (Full Aspect)</Select.Item>
            </Select.Content>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-[11px] font-semibold text-ui-fg-base">Image Alignment</Label>
          <Select
            value={config.image_position || "left"}
            onValueChange={(v) => updateConfig("image_position", v)}
          >
            <Select.Trigger className="text-xs h-8">
              <Select.Value />
            </Select.Trigger>
            <Select.Content>
              <Select.Item value="left">Left Side (Text Right)</Select.Item>
              <Select.Item value="right">Right Side (Text Left)</Select.Item>
            </Select.Content>
          </Select>
        </div>
      </div>
    </div>
  );
}
