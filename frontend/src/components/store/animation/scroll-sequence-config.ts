/**
 * CakeToHome Scroll-Driven Frame Animation Configuration
 * Centralized settings for the Apple-style scroll-sequence hero experience.
 */

export interface ScrollSequenceConfig {
  /** Base Cloudinary asset prefix without frame number */
  baseUrl: string;
  /** Total number of continuous frames available in the Cloudinary sequence */
  frameCount: number;
  /** Padding width for the frame number (e.g. 4 for '0001') */
  framePadding: number;
  /** 1-based index of the first frame */
  firstFrame: number;
  /** Multiplier for section scroll height (e.g. '450vh') */
  sectionHeight: string;
  /** Number of frames to sample on mobile viewports */
  mobileFrameCount: number;
  /** Number of frames on desktop viewports */
  desktopFrameCount: number;
  /** Easing factor for linear interpolation (0.05 to 0.25) */
  easing: number;
  /** Maximum device pixel ratio to cap GPU memory */
  pixelRatioLimit: number;
  /** Native source image width */
  nativeWidth: number;
  /** Native source image height */
  nativeHeight: number;
  /** Native aspect ratio (width / height) */
  aspectRatio: number;
  /** Fallback frame index to display if animation is unavailable */
  fallbackFrame: number;
  /** Cloudinary transformation string for desktop */
  cloudinaryTransformDesktop: string;
  /** Cloudinary transformation string for mobile */
  cloudinaryTransformMobile: string;
  /** Cloudinary base upload URL */
  cloudinaryUploadBase: string;
  /** Cloudinary asset version tag */
  assetVersion: string;
  /** Asset file prefix */
  filePrefix: string;
  /** File extension */
  fileExtension: string;
  /** Primary brand theme color */
  brandPrimary: string;
  /** Initial preload batch count */
  initialPreloadCount: number;
}

export const DEFAULT_SCROLL_SEQUENCE_CONFIG: ScrollSequenceConfig = {
  baseUrl: "https://res.cloudinary.com/r0k56n3j/image/upload/v1786881616/frames1_",
  frameCount: 39,
  framePadding: 4,
  firstFrame: 1,
  sectionHeight: "260vh",
  mobileFrameCount: 39,
  desktopFrameCount: 39,
  easing: 0.18,
  pixelRatioLimit: 2,
  nativeWidth: 1920,
  nativeHeight: 1080,
  aspectRatio: 1920 / 1080, // 16:9
  fallbackFrame: 1,
  cloudinaryUploadBase: "https://res.cloudinary.com/r0k56n3j/image/upload/",
  cloudinaryTransformDesktop: "f_auto,q_auto",
  cloudinaryTransformMobile: "f_auto,q_auto,w_800",
  assetVersion: "v1786881616",
  filePrefix: "frames1_",
  fileExtension: ".jpg",
  brandPrimary: "#1D2F5D",
  initialPreloadCount: 8,
};

/**
 * Resolves the optimized Cloudinary image URL for a given frame index.
 * Automatically applies responsive width and auto-format/quality transformations.
 */
export function resolveFrameUrl(
  frameIndex: number,
  isMobile: boolean = false,
  config: ScrollSequenceConfig = DEFAULT_SCROLL_SEQUENCE_CONFIG
): string {
  // Clamp frameIndex to [firstFrame, frameCount]
  const clampedIndex = Math.min(
    Math.max(frameIndex, config.firstFrame),
    config.frameCount
  );

  const paddedIndex = String(clampedIndex).padStart(config.framePadding, "0");
  const transform = isMobile
    ? config.cloudinaryTransformMobile
    : config.cloudinaryTransformDesktop;

  // Format: https://res.cloudinary.com/r0k56n3j/image/upload/{transform}/{version}/{prefix}{0001}.jpg
  if (transform) {
    return `${config.cloudinaryUploadBase}${transform}/${config.assetVersion}/${config.filePrefix}${paddedIndex}${config.fileExtension}`;
  }

  return `${config.baseUrl}${paddedIndex}${config.fileExtension}`;
}
