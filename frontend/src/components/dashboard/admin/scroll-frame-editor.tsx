"use client";

import React, { useState, useRef } from "react";
import {
  Text,
  Input,
  Label,
  Textarea,
  Select,
  Badge,
  Button,
} from "@medusajs/ui";
import {
  Film,
  Upload,
  Layers,
  Sparkles,
  Sliders,
  SlidersHorizontal,
  PlayCircle,
  Trash2,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertTriangle,
  FileImage,
  Percent,
  Monitor,
  Tablet as TabletIcon,
  Smartphone,
  Info,
  GripVertical,
} from "lucide-react";
import { AnimationFrameItem, DeviceAnimationConfig } from "../../../components/store/animation/scroll-frame-hero";
import { apiClient } from "../../../lib/api-client";

interface ScrollFrameEditorProps {
  config: any;
  onChange: (updatedConfig: any) => void;
}

const RECOMMENDED_FRAME_COUNT = 16;
const MAX_FRAME_COUNT = 22;

const DEVICE_DIMENSIONS = {
  desktop: { maxWidth: 1920, maxHeight: 1080, label: "1920 × 1080 (Desktop)" },
  tablet: { maxWidth: 1280, maxHeight: 720, label: "1280 × 720 (Tablet)" },
  mobile: { maxWidth: 828, maxHeight: 1792, label: "828 × 1792 (Mobile)" },
};

function Field({
  label,
  hint,
  children,
}: {
  label: string | React.ReactNode;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold text-ui-fg-base">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-ui-fg-muted">{hint}</p>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
        checked ? "bg-rose-500" : "bg-ui-bg-component border border-ui-border-base"
      }`}
      aria-label={label}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow ${
          checked ? "translate-x-4" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

// Client-side image compression & dimension optimization
async function compressImageToWebp(
  file: File,
  device: "desktop" | "tablet" | "mobile",
  qualityPreset: "high" | "balanced" | "performance"
): Promise<{
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  savingsPct: number;
  width: number;
  height: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const { maxWidth, maxHeight } = DEVICE_DIMENSIONS[device];
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas context creation failed"));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const quality = qualityPreset === "high" ? 0.9 : qualityPreset === "performance" ? 0.7 : 0.82;
        const webpDataUrl = canvas.toDataURL("image/webp", quality);

        const originalSize = file.size;
        // Approximate base64 byte size
        const compressedSize = Math.round((webpDataUrl.length - webpDataUrl.indexOf(",") - 1) * 0.75);
        const savingsPct = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

        resolve({
          dataUrl: webpDataUrl,
          originalSize,
          compressedSize,
          savingsPct,
          width,
          height,
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export function ScrollFrameEditor({ config, onChange }: ScrollFrameEditorProps) {
  const [activeDevice, setActiveDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [activeTab, setActiveTab] = useState<"media" | "animation" | "content">("media");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [uploadStats, setUploadStats] = useState<{ originalTotal: number; compressedTotal: number; savingsPct: number } | null>(null);
  const [previewFrame, setPreviewFrame] = useState<AnimationFrameItem | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Drag-and-drop frame reordering state
  const [draggedFrameIndex, setDraggedFrameIndex] = useState<number | null>(null);
  const [dragOverFrameIndex, setDragOverFrameIndex] = useState<number | null>(null);
  const [brokenFrameIds, setBrokenFrameIds] = useState<Set<string>>(new Set());

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const activeReplacingFrameIdRef = useRef<string | null>(null);

  // Get active device config with default structure
  const desktopConfig: DeviceAnimationConfig = config.desktop || {};
  const tabletConfig: DeviceAnimationConfig = config.tablet || {};
  const mobileConfig: DeviceAnimationConfig = config.mobile || {};

  const currentDeviceConfig: DeviceAnimationConfig =
    activeDevice === "mobile" ? mobileConfig : activeDevice === "tablet" ? tabletConfig : desktopConfig;

  const frames: AnimationFrameItem[] = currentDeviceConfig.frames || [];
  const currentFrameCount = frames.length;
  const isFallbackToDesktop = activeDevice !== "desktop" && currentDeviceConfig.use_desktop_fallback === true;

  const updateCurrentDeviceConfig = (partial: Partial<DeviceAnimationConfig>) => {
    const updated = { ...currentDeviceConfig, ...partial };
    onChange({
      ...config,
      [activeDevice]: updated,
    });
  };

  const updateRootConfig = (key: string, val: any) => {
    onChange({
      ...config,
      [key]: val,
    });
  };

  const uploadFrame = async (
    compressed: { dataUrl: string; compressedSize: number; width: number; height: number },
    filename: string
  ): Promise<string> => {
    const res: any = await apiClient.uploadMedia({
      filename,
      dataUrl: compressed.dataUrl,
      mime_type: "image/webp",
      size: compressed.compressedSize,
      width: compressed.width,
      height: compressed.height,
      folder: `kitchen_story_${activeDevice}`,
    });
    const url = res?.url || res?.media?.url;
    if (!url || String(url).startsWith("data:")) {
      throw new Error(res?.error || "Frame upload to media storage failed. Please try again.");
    }
    return url;
  };

  // ── 1. Batch Upload & Compression Pipeline ────────────────────────────────
  const handleFilesSelected = async (files: FileList | File[]) => {
    setErrorMessage(null);
    setInfoMessage(null);
    const fileArray = Array.from(files).filter((f) =>
      ["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(f.type)
    );

    if (fileArray.length === 0) {
      setErrorMessage("Please select valid image files (PNG, JPEG, or WEBP).");
      return;
    }

    const availableSlots = MAX_FRAME_COUNT - currentFrameCount;
    if (availableSlots <= 0) {
      setErrorMessage(`Maximum ${MAX_FRAME_COUNT} frames allowed. Delete existing frames before uploading new ones.`);
      return;
    }

    // Accept up to availableSlots, reject excess with notice
    let filesToProcess = fileArray;
    if (fileArray.length > availableSlots) {
      filesToProcess = fileArray.slice(0, availableSlots);
      setInfoMessage(`${filesToProcess.length} frames added. Maximum ${MAX_FRAME_COUNT} frames allowed.`);
    }

    setIsProcessing(true);
    try {
      const qualityPreset = currentDeviceConfig.compression_quality || "balanced";
      let origTotal = 0;
      let compTotal = 0;
      const newFrames: AnimationFrameItem[] = [];

      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        setProcessingStatus(`Optimizing frame ${i + 1} of ${filesToProcess.length}: ${file.name}...`);
        const compressed = await compressImageToWebp(file, activeDevice, qualityPreset);
        origTotal += compressed.originalSize;
        compTotal += compressed.compressedSize;

        // Upload to media storage (S3). Never embed base64 frames in the page record —
        // that bloats cms_page by megabytes and stalls the database on every page view.
        const storageUrl = await uploadFrame(compressed, `${activeDevice}_frame_${Date.now()}_${i + 1}.webp`);

        const seq = currentFrameCount + i + 1;
        newFrames.push({
          id: `frame_${activeDevice}_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          sequence: seq,
          filename: file.name,
          url: storageUrl,
          optimized_url: storageUrl,
          original_size: compressed.originalSize,
          compressed_size: compressed.compressedSize,
          savings_pct: compressed.savingsPct,
          width: compressed.width,
          height: compressed.height,
          format: "webp",
          device_target: activeDevice,
        });
      }

      const mergedFrames = [...frames, ...newFrames].map((f, idx) => ({
        ...f,
        sequence: idx + 1,
      }));

      const overallSavings = Math.round(((origTotal - compTotal) / origTotal) * 100);
      setUploadStats({ originalTotal: origTotal, compressedTotal: compTotal, savingsPct: overallSavings });

      updateCurrentDeviceConfig({
        frames: mergedFrames,
        frame_count: mergedFrames.length,
        enabled: true,
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to process and compress images.");
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
    }
  };

  // ── 2. Frame Replacement Pipeline ─────────────────────────────────────────
  const handleStartReplaceFrame = (frameId: string) => {
    activeReplacingFrameIdRef.current = frameId;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const frameId = activeReplacingFrameIdRef.current;
    if (!frameId) return;

    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(file.type)) {
      setErrorMessage("Please select a valid image file (PNG, JPEG, or WEBP) for replacement.");
      return;
    }

    setIsProcessing(true);
    setProcessingStatus(`Replacing and optimizing ${file.name}...`);
    try {
      const qualityPreset = currentDeviceConfig.compression_quality || "balanced";
      const compressed = await compressImageToWebp(file, activeDevice, qualityPreset);

      const storageUrl = await uploadFrame(compressed, `${activeDevice}_replaced_${Date.now()}.webp`);

      const targetIdx = frames.findIndex((f) => f.id === frameId);
      if (targetIdx >= 0) {
        const target = frames[targetIdx];
        const updatedFrame: AnimationFrameItem = {
          ...target,
          filename: file.name,
          url: storageUrl,
          optimized_url: storageUrl,
          original_size: compressed.originalSize,
          compressed_size: compressed.compressedSize,
          savings_pct: compressed.savingsPct,
          width: compressed.width,
          height: compressed.height,
          format: "webp",
          device_target: activeDevice,
        };

        const copy = [...frames];
        copy[targetIdx] = updatedFrame;
        updateCurrentDeviceConfig({ frames: copy });

        if (previewFrame?.id === frameId) {
          setPreviewFrame(updatedFrame);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to replace frame image.");
    } finally {
      setIsProcessing(false);
      setProcessingStatus(null);
      activeReplacingFrameIdRef.current = null;
      e.target.value = "";
    }
  };

  // ── 3. Frame Management (Reorder, Delete, Resequence) ──────────────────────
  const moveFrame = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= frames.length) return;
    const copy = [...frames];
    const [moved] = copy.splice(fromIndex, 1);
    copy.splice(toIndex, 0, moved);
    const resequenced = copy.map((f, idx) => ({ ...f, sequence: idx + 1 }));
    updateCurrentDeviceConfig({ frames: resequenced });
  };

  const handleFrameDragStart = (e: React.DragEvent, index: number) => {
    setDraggedFrameIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", index.toString());
  };

  const handleFrameDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverFrameIndex !== index) {
      setDragOverFrameIndex(index);
    }
  };

  const handleFrameDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedFrameIndex === null || draggedFrameIndex === targetIndex) {
      setDraggedFrameIndex(null);
      setDragOverFrameIndex(null);
      return;
    }
    const copy = [...frames];
    const [draggedItem] = copy.splice(draggedFrameIndex, 1);
    copy.splice(targetIndex, 0, draggedItem);
    const resequenced = copy.map((f, idx) => ({ ...f, sequence: idx + 1 }));
    updateCurrentDeviceConfig({ frames: resequenced });
    setDraggedFrameIndex(null);
    setDragOverFrameIndex(null);
  };

  const removeFrame = (frame: AnimationFrameItem) => {
    if (!confirm(`Delete Frame ${String(frame.sequence).padStart(2, "0")} (${frame.filename})?`)) return;
    const filtered = frames.filter((f) => f.id !== frame.id).map((f, idx) => ({ ...f, sequence: idx + 1 }));
    updateCurrentDeviceConfig({ frames: filtered, frame_count: filtered.length });
    if (previewFrame?.id === frame.id) setPreviewFrame(null);
  };

  const clearAllFrames = () => {
    if (!confirm(`Remove all ${frames.length} frames for ${activeDevice.toUpperCase()}?`)) return;
    updateCurrentDeviceConfig({ frames: [], frame_count: 0 });
    setUploadStats(null);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden file input for Replace Frame action */}
      <input
        ref={replaceFileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={handleReplaceFileSelected}
      />

      {/* ── DEVICE SELECTOR HEADER ── */}
      <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Film className="w-4 h-4 text-rose-600" />
            <Text className="text-xs font-bold uppercase tracking-wider">Animation Target Device</Text>
          </div>
          <Badge
            color={activeDevice === "desktop" ? "blue" : activeDevice === "tablet" ? "purple" : "green"}
            className="text-[10px] font-bold"
          >
            CURRENT DEVICE: {activeDevice.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-1.5 p-1 bg-ui-bg-base rounded-lg border border-ui-border-base">
          {[
            { id: "desktop" as const, label: "Desktop", icon: Monitor, dims: "1920×1080" },
            { id: "tablet" as const, label: "Tablet", icon: TabletIcon, dims: "1280×720" },
            { id: "mobile" as const, label: "Mobile", icon: Smartphone, dims: "828×1792" },
          ].map((dev) => {
            const Icon = dev.icon;
            const isSelected = activeDevice === dev.id;
            const count = (config[dev.id]?.frames || []).length;
            return (
              <button
                key={dev.id}
                type="button"
                onClick={() => {
                  setActiveDevice(dev.id);
                  setErrorMessage(null);
                  setInfoMessage(null);
                }}
                className={`py-2 px-2.5 rounded-md flex flex-col items-center gap-1 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-rose-500 text-white shadow-sm"
                    : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span>{dev.label}</span>
                </div>
                <span className={`text-[10px] font-medium opacity-85`}>
                  {count > 0 ? `${count} frames` : dev.dims}
                </span>
              </button>
            );
          })}
        </div>

        {/* Fallback configuration toggle for tablet/mobile */}
        {activeDevice !== "desktop" && (
          <div className="p-2.5 bg-ui-bg-base rounded-lg border border-ui-border-base flex items-center justify-between mt-1">
            <div className="flex flex-col">
              <Text className="text-xs font-semibold">Use Desktop Configuration</Text>
              <Text className="text-[10px] text-ui-fg-muted">
                {isFallbackToDesktop
                  ? `Currently inheriting Desktop's ${desktopConfig.frames?.length || 0} frames & animation`
                  : `Using dedicated ${activeDevice} frames & custom settings`}
              </Text>
            </div>
            <Toggle
              checked={isFallbackToDesktop}
              onChange={(v) => updateCurrentDeviceConfig({ use_desktop_fallback: v })}
              label="Fallback to desktop"
            />
          </div>
        )}
      </div>

      {/* ── SUB-TABS: MEDIA | ANIMATION | CONTENT ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b border-ui-border-base text-xs">
        {[
          { id: "media" as const, label: "Frame Media", icon: Layers, count: currentFrameCount },
          { id: "animation" as const, label: "Motion & Scrub", icon: Sliders },
          { id: "content" as const, label: "Story Overlays", icon: Sparkles },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs transition-all cursor-pointer ${
                isActive
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-ui-fg-muted hover:bg-ui-bg-subtle hover:text-ui-fg-base"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? "bg-white/20 text-white" : "bg-ui-bg-subtle text-ui-fg-muted"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 1. MEDIA TAB (UPLOAD, COMPRESSION, TIMELINE) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "media" && (
        <div className="flex flex-col gap-3">
          {/* Frame Count Policy & Metrics Card */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileImage className="w-4 h-4 text-rose-600" />
                <Text className="text-xs font-bold">
                  Frames: {currentFrameCount} / {MAX_FRAME_COUNT}
                </Text>
              </div>
              <Badge
                color={
                  currentFrameCount === 0
                    ? "grey"
                    : currentFrameCount <= RECOMMENDED_FRAME_COUNT
                    ? "green"
                    : "orange"
                }
                className="text-[10px] font-bold"
              >
                {currentFrameCount <= RECOMMENDED_FRAME_COUNT
                  ? `${RECOMMENDED_FRAME_COUNT} Recommended`
                  : `${currentFrameCount} / ${MAX_FRAME_COUNT} Max`}
              </Badge>
            </div>

            <Text className="text-[11px] text-ui-fg-muted leading-relaxed">
              <strong>{RECOMMENDED_FRAME_COUNT} frames</strong> is recommended for ultra-smooth 60fps motion without excessive memory. Maximum <strong>{MAX_FRAME_COUNT} frames</strong> allowed per device.
            </Text>

            {currentFrameCount > RECOMMENDED_FRAME_COUNT && (
              <div className="p-2 bg-brand-gold-light dark:bg-brand-gold-dark/40 border border-brand-gold/40 dark:border-brand-gold-dark rounded-lg flex items-center gap-2 text-[11px] text-brand-gold-dark dark:text-brand-gold/40">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Animation payload is large. Consider 16 frames for optimal mobile speed.</span>
              </div>
            )}
          </div>

          {/* Compression Preset Selector */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Image Compression Profile</Label>
              <span className="text-[10px] font-mono text-ui-fg-subtle">Target: WebP Format</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "high" as const, label: "High", hint: "90% Quality" },
                { id: "balanced" as const, label: "Balanced (Default)", hint: "82% Quality" },
                { id: "performance" as const, label: "Performance", hint: "70% Quality" },
              ].map((opt) => {
                const isSelected = (currentDeviceConfig.compression_quality || "balanced") === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateCurrentDeviceConfig({ compression_quality: opt.id })}
                    className={`p-2 rounded-lg border text-left flex flex-col gap-0.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-50 dark:bg-rose-950/30 border-rose-500 text-rose-700 dark:text-rose-300 shadow-xs"
                        : "bg-ui-bg-base border-ui-border-base text-ui-fg-muted hover:border-ui-border-strong"
                    }`}
                  >
                    <span className="text-xs font-bold">{opt.label}</span>
                    <span className="text-[10px] opacity-80">{opt.hint}</span>
                  </button>
                );
              })}
            </div>

            {uploadStats && (
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 rounded-lg flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300">
                <span className="flex items-center gap-1 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {(uploadStats.originalTotal / (1024 * 1024)).toFixed(1)} MB → {(uploadStats.compressedTotal / (1024 * 1024)).toFixed(1)} MB
                </span>
                <Badge color="green" className="text-[10px] font-black">
                  {uploadStats.savingsPct}% Smaller
                </Badge>
              </div>
            )}
          </div>

          {/* Upload Drag & Drop Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              if (e.dataTransfer.files) handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-all ${
              isDragOver
                ? "border-rose-500 bg-rose-50/50 dark:bg-rose-950/20"
                : "border-ui-border-base bg-ui-bg-subtle hover:bg-ui-bg-base hover:border-ui-border-strong"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFilesSelected(e.target.files);
                e.target.value = "";
              }}
            />

            <div className="p-3 bg-rose-100 dark:bg-rose-950/60 rounded-full text-rose-600">
              <Upload className="w-5 h-5" />
            </div>

            <div className="flex flex-col gap-0.5">
              <Text className="text-xs font-bold text-ui-fg-base">
                {isProcessing
                  ? processingStatus || "Processing & Compressing Frames..."
                  : "Drop animation frames here"}
              </Text>
              <Text className="text-[11px] text-ui-fg-muted">
                or click to browse from device (PNG, JPEG, WEBP)
              </Text>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] text-ui-fg-subtle pt-1">
              <span>Max {MAX_FRAME_COUNT} frames</span>
              <span>•</span>
              <span>Resized to {DEVICE_DIMENSIONS[activeDevice].label}</span>
            </div>
          </div>

          {infoMessage && (
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-xl flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0" />
              <span>{infoMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-2.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Frame Sequence / Timeline Strip */}
          {frames.length > 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex items-center justify-between">
                <Text className="text-xs font-bold">
                  Frame Sequence Timeline ({frames.length} / {MAX_FRAME_COUNT})
                </Text>
                <button
                  type="button"
                  onClick={clearAllFrames}
                  className="text-[11px] font-semibold text-red-600 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Clear All
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {frames.map((frame, index) => {
                  const isDragging = draggedFrameIndex === index;
                  const isOver = dragOverFrameIndex === index;
                  return (
                    <div
                      key={frame.id || `frame_${index}`}
                      draggable={true}
                      onDragStart={(e) => handleFrameDragStart(e, index)}
                      onDragOver={(e) => handleFrameDragOver(e, index)}
                      onDrop={(e) => handleFrameDrop(e, index)}
                      className={`p-2.5 bg-ui-bg-base border rounded-xl flex flex-col gap-2 relative group shadow-xs transition-all ${
                        isDragging
                          ? "opacity-40 border-rose-500 scale-95"
                          : isOver
                          ? "border-rose-500 ring-2 ring-rose-500/20"
                          : "border-ui-border-base hover:border-rose-400"
                      }`}
                    >
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-stone-900 flex items-center justify-center">
                        {brokenFrameIds.has(frame.id) ? (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-red-950/60 p-2 text-center text-red-300">
                            <AlertTriangle className="w-5 h-5 text-red-400 mb-1" />
                            <span className="text-[10px] font-bold">ASSET NOT FOUND (404)</span>
                          </div>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={frame.optimized_url || frame.url}
                            alt={`Frame ${frame.sequence}`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={() => {
                              setBrokenFrameIds((prev) => new Set(prev).add(frame.id));
                            }}
                          />
                        )}
                        <span className={`absolute top-1 left-1 px-1.5 py-0.5 rounded-md font-mono text-[10px] font-bold backdrop-blur-xs ${
                          brokenFrameIds.has(frame.id) ? "bg-red-600 text-white" : "bg-black/70 text-white"
                        }`}>
                          {String(frame.sequence).padStart(2, "0")}
                        </span>
                        <div
                          className="absolute top-1 right-1 p-1 rounded bg-black/50 text-white/70 hover:text-white cursor-grab"
                          title="Drag to reorder"
                        >
                          <GripVertical className="w-3 h-3" />
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-ui-fg-muted">
                        <span className="truncate max-w-[85px]" title={frame.filename}>
                          {frame.filename}
                        </span>
                        {frame.compressed_size && (
                          <span className="font-mono">{Math.round(frame.compressed_size / 1024)} KB</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-1.5 border-t border-ui-border-base">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => moveFrame(index, index - 1)}
                            className="p-1 rounded hover:bg-ui-bg-subtle disabled:opacity-25 cursor-pointer text-ui-fg-muted hover:text-ui-fg-base"
                            title="Move Left"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={index === frames.length - 1}
                            onClick={() => moveFrame(index, index + 1)}
                            className="p-1 rounded hover:bg-ui-bg-subtle disabled:opacity-25 cursor-pointer text-ui-fg-muted hover:text-ui-fg-base"
                            title="Move Right"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewFrame(frame)}
                            className="p-1 rounded hover:bg-ui-bg-subtle text-ui-fg-muted hover:text-ui-fg-base cursor-pointer"
                            title="Inspect Frame"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartReplaceFrame(frame.id)}
                            className="p-1 rounded hover:bg-brand-gold-light dark:hover:bg-brand-gold-dark/40 text-brand-gold cursor-pointer"
                            title="Replace Image"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFrame(frame)}
                            className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 cursor-pointer"
                            title="Delete Frame"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 2. ANIMATION TAB (CONTROLS, SPEED, SCRUB, EASING) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "animation" && (
        <div className="flex flex-col gap-3">
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex items-center justify-between">
            <div className="flex flex-col">
              <Text className="text-xs font-bold">Animation Enabled</Text>
              <Text className="text-[10px] text-ui-fg-muted">Enable scroll/motion playback for {activeDevice.toUpperCase()}</Text>
            </div>
            <Toggle
              checked={currentDeviceConfig.enabled !== false && config.disable_scroll_sequence !== true}
              onChange={(v) => {
                updateCurrentDeviceConfig({ enabled: v });
                if (v && config.disable_scroll_sequence) {
                  updateRootConfig("disable_scroll_sequence", false);
                }
              }}
              label="Enable animation"
            />
          </div>

          <Field label="Animation Mode" hint="Interaction style for animation frames">
            <Select
              value={currentDeviceConfig.animation_type || "scroll_frame"}
              onValueChange={(v) => updateCurrentDeviceConfig({ animation_type: v as any })}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="scroll_frame">Scroll Frame (Cinematic Scroll Scrub)</Select.Item>
                <Select.Item value="autoplay">Auto Play (Continuous Looping Video)</Select.Item>
                <Select.Item value="fade">Fade Sequence</Select.Item>
                <Select.Item value="marquee">Marquee</Select.Item>
                <Select.Item value="none">None (Static Poster Only)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Playback Speed / Scroll Distance">
            <Select
              value={currentDeviceConfig.speed || "normal"}
              onValueChange={(v) => updateCurrentDeviceConfig({ speed: v as any })}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="slow">Slow & Cinematic (350vh Distance)</Select.Item>
                <Select.Item value="normal">Normal / Balanced (280vh Distance)</Select.Item>
                <Select.Item value="fast">Fast & Snappy (200vh Distance)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Scroll Scrub">
              <div className="p-2 bg-ui-bg-subtle rounded-lg border border-ui-border-base flex items-center justify-between">
                <span className="text-xs font-semibold">Tied to Scroll</span>
                <Toggle
                  checked={currentDeviceConfig.scrub !== false}
                  onChange={(v) => updateCurrentDeviceConfig({ scrub: v })}
                  label="Scroll scrub"
                />
              </div>
            </Field>

            <Field label="Frame Smoothing">
              <div className="p-2 bg-ui-bg-subtle rounded-lg border border-ui-border-base flex items-center justify-between">
                <span className="text-xs font-semibold">RAF Interpolation</span>
                <Toggle
                  checked={currentDeviceConfig.smoothing !== false}
                  onChange={(v) => updateCurrentDeviceConfig({ smoothing: v })}
                  label="Smoothing"
                />
              </div>
            </Field>
          </div>

          <Field label="Easing Curve">
            <Select
              value={currentDeviceConfig.easing || "ease_in_out"}
              onValueChange={(v) => updateCurrentDeviceConfig({ easing: v as any })}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="linear">Linear (Direct Proportional)</Select.Item>
                <Select.Item value="ease_out">Ease Out (Snappy Entry)</Select.Item>
                <Select.Item value="ease_in_out">Ease In Out (Smooth Cinematic)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <Field label="Scrub Smoothing" hint="Dampens rapid scroll movements for buttery fluid scrub">
            <Select
              value={currentDeviceConfig.scrub_smoothing || "medium"}
              onValueChange={(v) => updateCurrentDeviceConfig({ scrub_smoothing: v as any })}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="off">Off (Immediate / 1:1 Raw Scroll)</Select.Item>
                <Select.Item value="low">Low (Snappy Responsive)</Select.Item>
                <Select.Item value="medium">Medium (Cinematic Smooth - Recommended)</Select.Item>
                <Select.Item value="high">High (Ultra-Fluid Heavy Dampening)</Select.Item>
              </Select.Content>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="First Frame Hold" hint="Holds initial hero image before scrub">
              <Select
                value={String(currentDeviceConfig.first_frame_hold_pct ?? 0.06)}
                onValueChange={(v) => updateCurrentDeviceConfig({ first_frame_hold_pct: parseFloat(v) })}
              >
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="0">0% (Immediate)</Select.Item>
                  <Select.Item value="0.04">4% (Brief)</Select.Item>
                  <Select.Item value="0.06">6% (Standard)</Select.Item>
                  <Select.Item value="0.10">10% (Extended)</Select.Item>
                  <Select.Item value="0.15">15% (Long Hold)</Select.Item>
                </Select.Content>
              </Select>
            </Field>

            <Field label="Final Frame Hold" hint="Holds completed cake before release">
              <Select
                value={String(currentDeviceConfig.final_frame_hold_pct ?? 0.10)}
                onValueChange={(v) => updateCurrentDeviceConfig({ final_frame_hold_pct: parseFloat(v) })}
              >
                <Select.Trigger><Select.Value /></Select.Trigger>
                <Select.Content>
                  <Select.Item value="0">0% (Instant Release)</Select.Item>
                  <Select.Item value="0.05">5% (Short)</Select.Item>
                  <Select.Item value="0.10">10% (Standard - Recommended)</Select.Item>
                  <Select.Item value="0.15">15% (Extended Hold)</Select.Item>
                  <Select.Item value="0.20">20% (Long Showcase)</Select.Item>
                </Select.Content>
              </Select>
            </Field>
          </div>

          <Field label="Preload Strategy" hint="Controls network buffering">
            <Select
              value={currentDeviceConfig.preload_strategy || "balanced"}
              onValueChange={(v) => updateCurrentDeviceConfig({ preload_strategy: v as any })}
            >
              <Select.Trigger><Select.Value /></Select.Trigger>
              <Select.Content>
                <Select.Item value="poster_first">Poster First, Then Stream on View (Recommended)</Select.Item>
                <Select.Item value="balanced">Balanced Preload (Nearby frames)</Select.Item>
                <Select.Item value="aggressive">Aggressive (Preload all frames)</Select.Item>
              </Select.Content>
            </Select>
          </Field>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 3. CONTENT TAB (TEXT & STORY OVERLAYS) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === "content" && (
        <div className="flex flex-col gap-3">
          {/* Phase 1: Intro Headline & CTAs */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-rose-600 uppercase">
              Phase 1: Main Headline & CTAs ({activeDevice.toUpperCase()})
            </Text>
            <Field label="Headline">
              <Input
                value={currentDeviceConfig.headline || config.headline || ""}
                onChange={(e) => updateCurrentDeviceConfig({ headline: e.target.value })}
                placeholder="Handcrafted Gourmet Cakes Delivered in 2 Hours"
              />
            </Field>
            <Field label="Subheadline">
              <Textarea
                value={currentDeviceConfig.subheadline || config.subheadline || ""}
                onChange={(e) => updateCurrentDeviceConfig({ subheadline: e.target.value })}
                placeholder="Fresh, artisanal birthday & wedding cakes across Kerala..."
                rows={2}
              />
            </Field>
            <Field label="Badge Text">
              <Input
                value={currentDeviceConfig.badge || config.badge_text || ""}
                onChange={(e) => updateCurrentDeviceConfig({ badge: e.target.value })}
                placeholder="100% Fresh & Artisanal • Express 2-Hour Delivery"
              />
            </Field>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <Field label="Primary CTA Text">
                <Input
                  value={currentDeviceConfig.cta_primary_text || config.cta_primary_text || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ cta_primary_text: e.target.value })}
                  placeholder="Explore Cakes"
                />
              </Field>
              <Field label="Primary CTA URL">
                <Input
                  value={currentDeviceConfig.cta_primary_url || config.cta_primary_url || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ cta_primary_url: e.target.value })}
                  placeholder="/products"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Secondary CTA Text">
                <Input
                  value={currentDeviceConfig.cta_secondary_text || config.cta_secondary_text || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ cta_secondary_text: e.target.value })}
                  placeholder="Birthday Specials"
                />
              </Field>
              <Field label="Secondary CTA URL">
                <Input
                  value={currentDeviceConfig.cta_secondary_url || config.cta_secondary_url || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ cta_secondary_url: e.target.value })}
                  placeholder="/products?occasion=birthday"
                />
              </Field>
            </div>
          </div>

          {/* Phase 2: Master Chocolatier Recipe Story */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-brand-gold uppercase">
              Phase 2: Master Chocolatier Story ({activeDevice.toUpperCase()})
            </Text>
            <Field label="Craft Badge">
              <Input
                value={currentDeviceConfig.craft_badge || config.craft_badge || ""}
                onChange={(e) => updateCurrentDeviceConfig({ craft_badge: e.target.value })}
                placeholder="Master Chocolatier Recipe"
              />
            </Field>
            <Field label="Craft Heading">
              <Input
                value={currentDeviceConfig.craft_heading || config.craft_heading || ""}
                onChange={(e) => updateCurrentDeviceConfig({ craft_heading: e.target.value })}
                placeholder="Every Layer, A Symphony of Flavor"
              />
            </Field>
            <Field label="Craft Description">
              <Textarea
                value={currentDeviceConfig.craft_text || config.craft_text || ""}
                onChange={(e) => updateCurrentDeviceConfig({ craft_text: e.target.value })}
                placeholder="Crafted with Belgian cocoa, Madagascan vanilla..."
                rows={2}
              />
            </Field>
          </div>

          {/* Phase 3: Transit & Fleet Guarantee */}
          <div className="p-3 bg-ui-bg-subtle rounded-xl border border-ui-border-base flex flex-col gap-2.5">
            <Text className="text-xs font-bold text-emerald-600 uppercase">
              Phase 3: Transit & Delivery Guarantee ({activeDevice.toUpperCase()})
            </Text>
            <Field label="Fleet Badge">
              <Input
                value={currentDeviceConfig.fleet_badge || config.fleet_badge || ""}
                onChange={(e) => updateCurrentDeviceConfig({ fleet_badge: e.target.value })}
                placeholder="Climate-Controlled Transit"
              />
            </Field>
            <Field label="Fleet Heading">
              <Input
                value={currentDeviceConfig.fleet_heading || config.fleet_heading || ""}
                onChange={(e) => updateCurrentDeviceConfig({ fleet_heading: e.target.value })}
                placeholder="Pristine & Chilled To Your Table"
              />
            </Field>
            <Field label="Fleet Description">
              <Textarea
                value={currentDeviceConfig.fleet_text || config.fleet_text || ""}
                onChange={(e) => updateCurrentDeviceConfig({ fleet_text: e.target.value })}
                placeholder="Specially engineered shock-absorbent cake domes..."
                rows={2}
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Fleet CTA Text">
                <Input
                  value={currentDeviceConfig.fleet_cta_text || config.fleet_cta_text || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ fleet_cta_text: e.target.value })}
                  placeholder="Order for Today"
                />
              </Field>
              <Field label="Fleet CTA URL">
                <Input
                  value={currentDeviceConfig.fleet_cta_url || config.fleet_cta_url || ""}
                  onChange={(e) => updateCurrentDeviceConfig({ fleet_cta_url: e.target.value })}
                  placeholder="/products"
                />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── PREVIEW FRAME MODAL ── */}
      {previewFrame && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-ui-bg-base border border-ui-border-base rounded-2xl max-w-xl w-full p-4 flex flex-col gap-3 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ui-border-base pb-2">
              <span className="text-xs font-bold">
                Frame {String(previewFrame.sequence).padStart(2, "0")} — {previewFrame.filename}
              </span>
              <button
                type="button"
                onClick={() => setPreviewFrame(null)}
                className="text-xs font-bold text-ui-fg-muted hover:text-ui-fg-base cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            <div className="relative aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewFrame.optimized_url || previewFrame.url}
                alt={`Frame ${previewFrame.sequence}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs bg-ui-bg-subtle p-2.5 rounded-xl border border-ui-border-base">
              <div>
                <span className="text-[10px] text-ui-fg-muted block">Dimensions</span>
                <span className="font-bold">{previewFrame.width} × {previewFrame.height}</span>
              </div>
              <div>
                <span className="text-[10px] text-ui-fg-muted block">Optimized Size</span>
                <span className="font-bold">{Math.round((previewFrame.compressed_size || 0) / 1024)} KB</span>
              </div>
              <div>
                <span className="text-[10px] text-ui-fg-muted block">Format</span>
                <span className="font-bold uppercase">{previewFrame.format || "webp"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
