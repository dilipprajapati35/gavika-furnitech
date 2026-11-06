/**
 * Extract multiple image URLs for a product with fallback compatibility.
 * Supports:
 * 1. PostgreSQL text[] arrays (product.images)
 * 2. Delimiter separated strings ("url1|||url2")
 * 3. JSON stringified arrays ('["url1", "url2"]')
 * 4. Single image_url / image fallback
 */
export function extractProductImages(product: {
  image_url?: string | null;
  images?: string[] | null;
  image?: string | null;
}): string[] {
  if (Array.isArray(product.images) && product.images.length > 0) {
    const valid = product.images.filter((img) => Boolean(img && typeof img === "string"));
    if (valid.length > 0) return valid;
  }

  const raw = product.image_url || product.image;
  if (!raw || typeof raw !== "string") return [];

  const trimmed = raw.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(Boolean);
      }
    } catch {}
  }

  if (trimmed.includes("|||")) {
    return trimmed.split("|||").filter(Boolean);
  }

  return [trimmed];
}

/**
 * Extracts the storage file path (e.g. "products/173000-0-abc.jpg") from a Supabase storage URL.
 * Only targets files belonging to the designated storage bucket.
 */
export function extractStoragePath(
  url: string,
  bucketName: string = "gavika-project-files"
): string | null {
  if (!url || typeof url !== "string") return null;

  try {
    const cleanUrl = url.split("?")[0].trim();
    const bucketMarker = `/${bucketName}/`;
    const markerIndex = cleanUrl.indexOf(bucketMarker);

    if (markerIndex !== -1) {
      return decodeURIComponent(cleanUrl.substring(markerIndex + bucketMarker.length));
    }

    if (cleanUrl.startsWith("products/")) {
      return decodeURIComponent(cleanUrl);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Deletes an array of image URLs from Supabase storage bucket.
 * Gracefully ignores non-bucket URLs (such as external links or placeholders).
 */
export async function deleteProductImagesFromStorage(
  supabaseClient: any,
  urls: (string | null | undefined)[],
  bucketName: string = "gavika-project-files"
): Promise<{ deleted: string[]; errors: any[] }> {
  const pathsToDelete: string[] = [];

  for (const url of urls) {
    if (!url) continue;
    const path = extractStoragePath(url, bucketName);
    if (path && !pathsToDelete.includes(path)) {
      pathsToDelete.push(path);
    }
  }

  if (pathsToDelete.length === 0) {
    return { deleted: [], errors: [] };
  }

  try {
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .remove(pathsToDelete);

    if (error) {
      console.warn("Storage deletion warning:", error.message || error);
      return { deleted: [], errors: [error] };
    }

    return { deleted: pathsToDelete, errors: [] };
  } catch (err: any) {
    console.warn("Storage deletion exception:", err?.message || err);
    return { deleted: [], errors: [err] };
  }
}

/**
 * Formats a raw price string into Indian Rupees (e.g., "14200" -> "₹14,200")
 * or returns a formatted badge indicator (e.g. "Coming Soon", "Price on request").
 */
export function formatPrice(raw: string | null | undefined): {
  text: string;
  isBadge: boolean;
} {
  if (!raw) return { text: "Price on request", isBadge: true };
  const trimmed = raw.trim();
  if (!trimmed) return { text: "Price on request", isBadge: true };
  if (trimmed.toLowerCase().includes("coming soon")) {
    return { text: "Coming Soon", isBadge: true };
  }
  if (trimmed.startsWith("₹")) {
    return { text: trimmed, isBadge: false };
  }
  const cleanNum = trimmed.replace(/[^\d.]/g, "");
  if (cleanNum && !isNaN(Number(cleanNum))) {
    return {
      text: `₹${Number(cleanNum).toLocaleString("en-IN")}`,
      isBadge: false,
    };
  }
  return { text: trimmed, isBadge: true };
}


