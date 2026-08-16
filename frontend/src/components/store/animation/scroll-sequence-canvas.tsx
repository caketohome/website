"use client";

import React, { useEffect, useRef, memo } from "react";
import { FrameCache } from "./frame-cache";
import {
  ScrollSequenceConfig,
  DEFAULT_SCROLL_SEQUENCE_CONFIG,
} from "./scroll-sequence-config";

export interface ScrollSequenceCanvasProps {
  frameCache: FrameCache;
  targetProgress: number; // 0 to 1
  config?: ScrollSequenceConfig;
  className?: string;
  onInitialFrameRendered?: () => void;
}

export const ScrollSequenceCanvas = memo(function ScrollSequenceCanvas({
  frameCache,
  targetProgress,
  config = DEFAULT_SCROLL_SEQUENCE_CONFIG,
  className = "",
  onInitialFrameRendered,
}: ScrollSequenceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const currentFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);
  const rafIdRef = useRef<number | null>(null);
  const isVisibleRef = useRef<boolean>(true);
  const hasRenderedInitialRef = useRef<boolean>(false);
  const lastDrawnFrameRef = useRef<number>(-1);

  // Update target frame based on targetProgress (0 -> 1)
  useEffect(() => {
    const rawTarget = 1 + targetProgress * (config.frameCount - 1);
    targetFrameRef.current = Math.min(
      Math.max(rawTarget, config.firstFrame),
      config.frameCount
    );

    // Request priority preloading for upcoming frames around current target
    frameCache.prioritizeAround(targetFrameRef.current);
  }, [targetProgress, config.frameCount, config.firstFrame, frameCache]);

  // Main Canvas Render Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;

    let isRunning = true;

    // High-DPI Resize Handler
    const updateCanvasDimensions = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, config.pixelRatioLimit);

      const displayWidth = Math.round(rect.width);
      const displayHeight = Math.round(rect.height);

      if (
        canvas.width !== displayWidth * dpr ||
        canvas.height !== displayHeight * dpr
      ) {
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
      }
    };

    updateCanvasDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasDimensions();
      // Force redrawing the current frame on resize
      lastDrawnFrameRef.current = -1;
    });

    resizeObserver.observe(canvas);

    // Render a single image to canvas with cover fitting
    const drawImageCover = (img: HTMLImageElement) => {
      if (!canvas || !ctx) return;

      const cw = canvas.width;
      const ch = canvas.height;
      const iw = img.naturalWidth || config.nativeWidth;
      const ih = img.naturalHeight || config.nativeHeight;

      // Calculate cover dimensions and centering
      const scale = Math.max(cw / iw, ch / ih);
      const nw = iw * scale;
      const nh = ih * scale;
      const nx = (cw - nw) / 2;
      const ny = (ch - nh) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, nx, ny, nw, nh);
    };

    // Animation loop with linear interpolation
    const renderLoop = () => {
      if (!isRunning) return;

      if (isVisibleRef.current) {
        // Interpolate current frame towards target frame
        const diff = targetFrameRef.current - currentFrameRef.current;

        if (Math.abs(diff) > 0.001) {
          currentFrameRef.current += diff * config.easing;
        } else {
          currentFrameRef.current = targetFrameRef.current;
        }

        const effectiveFrame = Math.round(currentFrameRef.current);

        // Render if frame changed or needs initial paint
        if (effectiveFrame !== lastDrawnFrameRef.current) {
          const img = frameCache.getNearestFrame(effectiveFrame);
          if (img && img.complete && img.naturalWidth > 0) {
            drawImageCover(img);
            lastDrawnFrameRef.current = effectiveFrame;

            if (!hasRenderedInitialRef.current) {
              hasRenderedInitialRef.current = true;
              onInitialFrameRendered?.();
            }
          }
        }
      }

      rafIdRef.current = requestAnimationFrame(renderLoop);
    };

    rafIdRef.current = requestAnimationFrame(renderLoop);

    // Visibility API support
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === "visible";
      if (isVisibleRef.current) {
        // Force redraw on resume
        lastDrawnFrameRef.current = -1;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Subscribe to frame load notifications so newly available frames immediately paint
    const unsubscribe = frameCache.subscribe((loadedIndex) => {
      const current = Math.round(currentFrameRef.current);
      if (Math.abs(loadedIndex - current) <= 2) {
        lastDrawnFrameRef.current = -1;
      }
    });

    return () => {
      isRunning = false;
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      unsubscribe();
    };
  }, [frameCache, config, onInitialFrameRendered]);

  return (
    <canvas
      ref={canvasRef}
      className={`w-full h-full object-cover block select-none pointer-events-none ${className}`}
      style={{
        backgroundColor: "#0d1322",
      }}
      aria-hidden="true"
    />
  );
});
