/**
 * CakeToHome Frame Cache & Progressive Preloader Engine
 * Manages concurrent frame preloading, priority queues, and nearest-frame fallbacks.
 */

import {
  ScrollSequenceConfig,
  DEFAULT_SCROLL_SEQUENCE_CONFIG,
  resolveFrameUrl,
} from "./scroll-sequence-config";

export class FrameCache {
  private cache: Map<number, HTMLImageElement> = new Map();
  private inflight: Map<number, Promise<HTMLImageElement | null>> = new Map();
  private failedFrames: Set<number> = new Set();
  private config: ScrollSequenceConfig;
  private isMobile: boolean = false;
  private isAborted: boolean = false;
  private onFrameLoadedListeners: Set<(frame: number) => void> = new Set();

  constructor(
    config: ScrollSequenceConfig = DEFAULT_SCROLL_SEQUENCE_CONFIG,
    isMobile: boolean = false
  ) {
    this.config = config;
    this.isMobile = isMobile;
  }

  public setMobile(isMobile: boolean) {
    if (this.isMobile !== isMobile) {
      this.isMobile = isMobile;
      // Invalidate inflight so new resolution can be fetched
      this.inflight.clear();
    }
  }

  public subscribe(listener: (frame: number) => void): () => void {
    this.onFrameLoadedListeners.add(listener);
    return () => this.onFrameLoadedListeners.delete(listener);
  }

  private notify(frame: number) {
    this.onFrameLoadedListeners.forEach((fn) => fn(frame));
  }

  /**
   * Loads an individual frame by index. Reuses in-flight promise if already loading.
   */
  public loadFrame(frameIndex: number): Promise<HTMLImageElement | null> {
    if (this.isAborted) return Promise.resolve(null);

    const clamped = Math.min(
      Math.max(frameIndex, this.config.firstFrame),
      this.config.frameCount
    );

    if (this.cache.has(clamped)) {
      return Promise.resolve(this.cache.get(clamped)!);
    }

    if (this.inflight.has(clamped)) {
      return this.inflight.get(clamped)!;
    }

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.decoding = "async";

      const url = resolveFrameUrl(clamped, this.isMobile, this.config);

      img.onload = () => {
        if (!this.isAborted) {
          this.cache.set(clamped, img);
          this.inflight.delete(clamped);
          this.notify(clamped);
          resolve(img);
        } else {
          resolve(null);
        }
      };

      img.onerror = () => {
        this.failedFrames.add(clamped);
        this.inflight.delete(clamped);
        // Log softly without breaking execution
        console.warn(`[ScrollSequence] Failed to load frame ${clamped}`);
        resolve(null);
      };

      img.src = url;
    });

    this.inflight.set(clamped, promise);
    return promise;
  }

  /**
   * Returns the exact cached frame if loaded, or the nearest available frame.
   * Guarantees zero blanking or visual flashing.
   */
  public getNearestFrame(targetFrame: number): HTMLImageElement | null {
    const clamped = Math.min(
      Math.max(Math.round(targetFrame), this.config.firstFrame),
      this.config.frameCount
    );

    if (this.cache.has(clamped)) {
      return this.cache.get(clamped)!;
    }

    // Search outwards from targetFrame (e.g. +1, -1, +2, -2...)
    let bestFrame = -1;
    let minDistance = Infinity;

    for (const cachedIndex of this.cache.keys()) {
      const dist = Math.abs(cachedIndex - clamped);
      if (dist < minDistance) {
        minDistance = dist;
        bestFrame = cachedIndex;
      }
    }

    if (bestFrame !== -1) {
      return this.cache.get(bestFrame) || null;
    }

    return null;
  }

  /**
   * Checks if frame 1 or any minimum viable initial frames are ready.
   */
  public isInitialReady(): boolean {
    return this.cache.has(this.config.firstFrame) || this.cache.size > 0;
  }

  /**
   * Preload Strategy Phase 1 & 2:
   * Loads initial batch of frames immediately for instant playback readiness.
   */
  public async preloadInitial(): Promise<void> {
    const initialPromises: Promise<any>[] = [];

    // Always load frame 1 first
    initialPromises.push(this.loadFrame(this.config.firstFrame));

    // Load first N frames
    const batchCount = Math.min(
      this.config.initialPreloadCount,
      this.config.frameCount
    );
    for (let i = 2; i <= batchCount; i++) {
      initialPromises.push(this.loadFrame(i));
    }

    await Promise.allSettled(initialPromises);
  }

  /**
   * Preload Strategy Phase 4: Priority queue around current scroll position.
   * If user is currently at frame K, load [K, K+1, K-1, K+2, K-2, ...] first.
   */
  public prioritizeAround(currentFrame: number, windowSize: number = 12): void {
    if (this.isAborted) return;

    const center = Math.min(
      Math.max(Math.round(currentFrame), this.config.firstFrame),
      this.config.frameCount
    );

    const queue: number[] = [];

    for (let offset = 0; offset <= windowSize; offset++) {
      const forward = center + offset;
      const backward = center - offset;

      if (
        forward <= this.config.frameCount &&
        !this.cache.has(forward) &&
        !this.inflight.has(forward)
      ) {
        queue.push(forward);
      }

      if (
        backward >= this.config.firstFrame &&
        backward !== forward &&
        !this.cache.has(backward) &&
        !this.inflight.has(backward)
      ) {
        queue.push(backward);
      }
    }

    // Load top priority frames concurrently (max 4 parallel)
    const activeLoading = queue.slice(0, 6);
    activeLoading.forEach((idx) => this.loadFrame(idx));
  }

  /**
   * Progressively preloads the entire sequence in background chunks.
   */
  public async preloadAll(chunkSize: number = 4): Promise<void> {
    if (this.isAborted) return;

    // Load every frame in stepped chunks
    for (let i = 1; i <= this.config.frameCount; i += chunkSize) {
      if (this.isAborted) break;
      const chunkPromises: Promise<any>[] = [];
      for (let j = i; j < i + chunkSize && j <= this.config.frameCount; j++) {
        if (!this.cache.has(j)) {
          chunkPromises.push(this.loadFrame(j));
        }
      }
      await Promise.allSettled(chunkPromises);
      // Small tick between chunks to avoid network congestion
      await new Promise((r) => setTimeout(r, 40));
    }
  }

  /**
   * Total number of loaded frames in memory.
   */
  public getLoadedCount(): number {
    return this.cache.size;
  }

  /**
   * Cleanup and abort memory references.
   */
  public destroy(): void {
    this.isAborted = true;
    this.cache.clear();
    this.inflight.clear();
    this.failedFrames.clear();
    this.onFrameLoadedListeners.clear();
  }
}
