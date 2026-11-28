/**
 * High-performance, client-side image compression utility.
 * Resizes large camera photos to web-optimal dimensions and converts them
 * to modern WebP format while preserving crystal-clear furniture textures.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.0 to 1.0 (default: 0.82)
  targetFormat?: "image/webp" | "image/jpeg";
}

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  previewUrl: string;
  width: number;
  height: number;
}

/**
 * Format raw byte count into human-readable string (e.g. "4.8 MB", "182 KB").
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Compresses a single image File in the browser using HTML5 Canvas.
 * Non-image files (PDFs, docs) are returned untouched.
 */
export async function compressImageFile(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.82,
    targetFormat = "image/webp",
  } = options;

  const originalSize = file.size;

  // If not an image, return original file without modification
  if (!file.type.startsWith("image/") || typeof window === "undefined") {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      previewUrl: URL.createObjectURL(file),
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let { width, height } = img;

      // Scale down proportionally if larger than maximum bounds
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Create an offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback: return original file if canvas context unavailable
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savedPercentage: 0,
          previewUrl: URL.createObjectURL(file),
          width: img.width,
          height: img.height,
        });
        return;
      }

      // High-quality bicubic smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Determine output mime type
      const outputType = targetFormat;
      const extension = outputType === "image/webp" ? "webp" : "jpg";

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savedPercentage: 0,
              previewUrl: URL.createObjectURL(file),
              width,
              height,
            });
            return;
          }

          // Generate clean file name with .webp extension
          const originalBaseName = file.name.substring(
            0,
            file.name.lastIndexOf(".")
          ) || file.name;
          const cleanName = `${originalBaseName.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`;

          const compressedFile = new File([blob], cleanName, {
            type: outputType,
            lastModified: Date.now(),
          });

          const compressedSize = compressedFile.size;
          const savedPercentage =
            originalSize > compressedSize
              ? Math.round(((originalSize - compressedSize) / originalSize) * 100)
              : 0;

          const previewUrl = URL.createObjectURL(compressedFile);

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            savedPercentage,
            previewUrl,
            width,
            height,
          });
        },
        outputType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savedPercentage: 0,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Batch compress multiple image files sequentially with progress reporting.
 */
export async function compressImageFiles(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (completed: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];
  for (let i = 0; i < files.length; i++) {
    const result = await compressImageFile(files[i], options);
    results.push(result);
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }
  return results;
}
