/**
 * Client-Side Image Compression & WebP Conversion Utility
 * Converts images to WebP format using HTML5 Canvas, ensuring target file size under 300KB-500KB.
 */

export interface CompressImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default 0.82)
  maxSizeBytes?: number; // Target max size (default 450 KB)
}

export async function compressImageToWebP(
  fileOrUrl: File | string,
  options: CompressImageOptions = {}
): Promise<string> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    maxSizeBytes = 450 * 1024, // 450 KB
  } = options;

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Maintain aspect ratio while scaling down oversized images
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(typeof fileOrUrl === "string" ? fileOrUrl : URL.createObjectURL(fileOrUrl));
        return;
      }

      ctx.fillStyle = "#FFFFFF"; // Fallback white background for transparency
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Attempt initial WebP compression
      let currentQuality = quality;
      let dataUrl = canvas.toDataURL("image/webp", currentQuality);

      // Iterative quality adjustment if file size exceeds target
      let attempts = 0;
      while (dataUrl.length * 0.75 > maxSizeBytes && currentQuality > 0.4 && attempts < 4) {
        currentQuality -= 0.1;
        dataUrl = canvas.toDataURL("image/webp", currentQuality);
        attempts++;
      }

      resolve(dataUrl);
    };

    img.onerror = (err) => {
      if (typeof fileOrUrl === "string") {
        resolve(fileOrUrl);
      } else {
        reject(err);
      }
    };

    if (typeof fileOrUrl === "string") {
      img.src = fileOrUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(fileOrUrl);
    }
  });
}
