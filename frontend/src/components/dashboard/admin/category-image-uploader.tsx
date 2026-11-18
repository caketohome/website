"use client";

import React, { useState, useRef, useEffect } from "react";
import { Text, Button, Label, Badge } from "@medusajs/ui";
import { Upload, Image as ImageIcon, Trash2, RefreshCw, CheckCircle2, AlertCircle, Link as LinkIcon, FileImage } from "lucide-react";
import { compressImageToWebP } from "@frontend/lib/util/image-compressor";
import { apiClient } from "@frontend/lib/api-client";

interface CategoryImageUploaderProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  type: "thumbnail" | "hero";
  helperText?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

export function CategoryImageUploader({
  label,
  value,
  onChange,
  type,
  helperText,
  onUploadingChange,
}: CategoryImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [customUrl, setCustomUrl] = useState("");
  
  // File metadata for preview
  const [fileMeta, setFileMeta] = useState<{
    name: string;
    sizeKb: number;
    dimensions: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Notify parent of uploading state
  useEffect(() => {
    onUploadingChange?.(uploading);
  }, [uploading, onUploadingChange]);

  // If value exists on initial load, measure image dimensions if possible
  useEffect(() => {
    if (value && !fileMeta) {
      const img = new Image();
      img.onload = () => {
        setFileMeta({
          name: value.split("/").pop()?.split("?")[0] || "Category Image",
          sizeKb: 0,
          dimensions: `${img.width} × ${img.height} px`,
        });
      };
      img.src = value;
    }
  }, [value]);

  const validateAndProcessFile = async (file: File) => {
    setError(null);

    // 1. Validate MIME type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setError("Invalid format. Please upload JPG, PNG, or WebP only (SVG & executables rejected).");
      return;
    }

    // 2. Validate max size (10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError("File exceeds 10MB limit. Please select a smaller original image.");
      return;
    }

    setUploading(true);
    setProgress(20);

    try {
      // 3. Configure compression profile based on type
      const isHero = type === "hero";
      const compressionOptions = isHero
        ? {
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.85,
            maxSizeBytes: 1200 * 1024, // ~1.2 MB max for hero
          }
        : {
            maxWidth: 600,
            maxHeight: 600,
            quality: 0.82,
            maxSizeBytes: 400 * 1024, // ~400 KB max for thumbnail
          };

      setProgress(40);
      const compressedDataUrl = await compressImageToWebP(file, compressionOptions);
      setProgress(70);

      // Measure dimensions of compressed WebP
      const img = new Image();
      await new Promise((res) => {
        img.onload = () => res(true);
        img.onerror = () => res(true);
        img.src = compressedDataUrl;
      });

      const approxSizeKb = Math.round((compressedDataUrl.length * 0.75) / 1024);
      const originalExt = file.name.split(".").pop() || "jpg";
      const cleanBaseName = file.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
      const safeFilename = `${cleanBaseName}.webp`;

      // 4. Upload to backend
      setProgress(85);
      const res: any = await apiClient.uploadMedia({
        name: cleanBaseName,
        filename: safeFilename,
        dataUrl: compressedDataUrl,
        mime_type: "image/webp",
        size: approxSizeKb * 1024,
        alt_text: cleanBaseName.replace(/[-_]+/g, " "),
        folder: "categories",
        width: img.width || (isHero ? 1200 : 500),
        height: img.height || (isHero ? 600 : 500),
      });

      setProgress(100);

      const uploadedUrl = res?.media?.url || res?.url || compressedDataUrl;
      onChange(uploadedUrl);

      setFileMeta({
        name: safeFilename,
        sizeKb: approxSizeKb,
        dimensions: `${img.width} × ${img.height} px`,
      });

      setShowUrlInput(false);
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Failed to process and upload image.");
    } finally {
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
      }, 400);
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
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    onChange("");
    setFileMeta(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleApplyCustomUrl = () => {
    if (customUrl.trim()) {
      onChange(customUrl.trim());
      setFileMeta({
        name: customUrl.split("/").pop()?.split("?")[0] || "Custom Image URL",
        sizeKb: 0,
        dimensions: "External Asset",
      });
      setShowUrlInput(false);
    }
  };

  const isHero = type === "hero";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="font-semibold text-xs text-ui-fg-base flex items-center gap-1.5">
          {label}
          <Badge color={isHero ? "purple" : "blue"} className="text-[10px] py-0 px-1.5 font-normal">
            {isHero ? "1920×1080 (WebP)" : "600×600 (WebP)"}
          </Badge>
        </Label>
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-[11px] text-brand-primary hover:text-brand-navy hover:underline flex items-center gap-1"
        >
          <LinkIcon className="w-3 h-3" />
          {showUrlInput ? "Hide URL input" : "Paste URL instead"}
        </button>
      </div>

      {/* Manual URL Input Fallback */}
      {showUrlInput && (
        <div className="flex gap-2 p-2.5 bg-ui-bg-subtle rounded-lg border border-ui-border-base">
          <input
            type="url"
            placeholder="Upload an image (stored in S3)"
            value={customUrl || value}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="flex-1 px-3 py-1.5 text-xs rounded border border-ui-border-base bg-white dark:bg-slate-900"
          />
          <Button size="small" type="button" onClick={handleApplyCustomUrl}>
            Apply URL
          </Button>
        </div>
      )}

      {/* Upload State / Error Alerts */}
      {error && (
        <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Image Uploader / Preview Container */}
      {value ? (
        <div className="relative border border-ui-border-base rounded-xl overflow-hidden bg-ui-bg-subtle/50 p-3">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {/* Image Preview Container */}
            <div
              className={`relative overflow-hidden rounded-lg border border-ui-border-base bg-white dark:bg-slate-900 shrink-0 ${
                isHero
                  ? "w-full sm:w-64 h-32 aspect-video"
                  : "w-24 h-24 sm:w-28 sm:h-28 aspect-square"
              }`}
            >
              <img
                src={value}
                alt={label}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-1.5 left-1.5 bg-emerald-600/90 backdrop-blur-sm text-white px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </div>
            </div>

            {/* Image Details & Action Buttons */}
            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-center gap-2">
                <FileImage className="w-4 h-4 text-brand-primary shrink-0" />
                <Text className="text-xs font-semibold text-ui-fg-base truncate">
                  {fileMeta?.name || "Uploaded Category Asset"}
                </Text>
              </div>

              <div className="flex flex-wrap gap-2 text-[11px] text-ui-fg-subtle">
                {fileMeta?.dimensions && (
                  <span className="bg-ui-bg-base px-2 py-0.5 rounded border border-ui-border-base">
                    📐 {fileMeta.dimensions}
                  </span>
                )}
                {fileMeta?.sizeKb ? (
                  <span className="bg-ui-bg-base px-2 py-0.5 rounded border border-ui-border-base">
                    ⚡ {fileMeta.sizeKb} KB (Optimized WebP)
                  </span>
                ) : null}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="text-xs h-7 gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Replace Image
                </Button>
                <Button
                  size="small"
                  variant="danger"
                  type="button"
                  onClick={handleRemove}
                  disabled={uploading}
                  className="text-xs h-7 gap-1"
                >
                  <Trash2 className="w-3 h-3" /> Remove
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty Dropzone Container */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2.5 ${
            isDragging
              ? "border-brand-primary bg-brand-light/50 dark:bg-brand-navy/20"
              : "border-ui-border-base hover:border-brand-primary bg-ui-bg-subtle/30 hover:bg-brand-light/20"
          } ${uploading ? "pointer-events-none opacity-80" : ""}`}
        >
          {uploading ? (
            <div className="w-full max-w-xs space-y-2 py-2">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-primary">
                <span>Optimizing & Uploading to WebP...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-brand-light rounded-full h-2 overflow-hidden">
                <div
                  className="bg-brand-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <Text className="text-[11px] text-ui-fg-muted">Compressing and securing file...</Text>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-brand-light dark:bg-brand-navy/40 text-brand-primary flex items-center justify-center shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <Text className="text-xs font-bold text-ui-fg-base">
                  📷 Drop image here or <span className="text-brand-primary underline">Choose Image</span>
                </Text>
                <Text className="text-[11px] text-ui-fg-subtle mt-0.5">
                  Supports JPG, PNG, or WebP • Max 10 MB (Auto-compressed to WebP)
                </Text>
              </div>
              {helperText && (
                <Text className="text-[10px] text-ui-fg-muted italic">
                  {helperText}
                </Text>
              )}
            </>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
