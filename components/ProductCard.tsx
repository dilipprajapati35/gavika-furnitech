"use client";

import { useEffect, useRef, useState } from "react";
import { extractProductImages, formatPrice } from "@/utils/product-images";

export type ProductCardItem = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  price: string;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | null;
};

interface ProductCardProps {
  product: ProductCardItem;
  onView: (index: number) => void;
  onBuyNow: () => void;
}

export default function ProductCard({
  product,
  onView,
  onBuyNow,
}: ProductCardProps) {
  const allImages = extractProductImages(product);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const displayImages =
    allImages.length > 0
      ? allImages
      : ([product.image_url, product.image].filter(Boolean) as string[]);

  const currentImageUrl =
    displayImages[activeImageIndex] ||
    (product.image_url && typeof product.image_url === "string"
      ? product.image_url
      : null) ||
    (product.image && typeof product.image === "string" ? product.image : null);

  useEffect(() => {
    setImageError(false);
  }, [activeImageIndex, currentImageUrl]);

  const priceData = formatPrice(product.price);

  return (
    <article className="group rounded-2xl bg-white border border-[#e7dccd] hover:border-[#b8956e] overflow-hidden shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col justify-between">
      <div>
        {/* Image Display with Click to View Modal */}
        <div
          onClick={() => onView(activeImageIndex)}
          onTouchStart={(e) => {
            touchStartRef.current = {
              x: e.touches[0].clientX,
              y: e.touches[0].clientY,
            };
          }}
          onTouchEnd={(e) => {
            if (!touchStartRef.current || displayImages.length <= 1) return;
            const diffX = touchStartRef.current.x - e.changedTouches[0].clientX;
            const diffY = touchStartRef.current.y - e.changedTouches[0].clientY;
            if (Math.abs(diffX) > 30 && Math.abs(diffX) > Math.abs(diffY)) {
              if (diffX > 0) {
                setActiveImageIndex((prev) => (prev + 1) % displayImages.length);
              } else {
                setActiveImageIndex(
                  (prev) => (prev - 1 + displayImages.length) % displayImages.length
                );
              }
            }
            touchStartRef.current = null;
          }}
          className="relative aspect-[4/3] bg-[#f5efe6] overflow-hidden select-none cursor-pointer group/img touch-pan-y"
          title="Click to view full photo and details"
        >
          {currentImageUrl && !imageError ? (
            <img
              src={currentImageUrl}
              alt={product.name}
              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-500 ease-out"
              onError={() => setImageError(true)}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#f4efe8] text-stone-400 p-4 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/90 border border-[#e7dccd] flex items-center justify-center text-2xl shadow-2xs mb-2">
                📷
              </div>
              <span className="text-xs font-semibold text-[#7a5235]">
                No Image Available
              </span>
              <span className="text-[10px] text-stone-400 mt-0.5">
                Click to view details
              </span>
            </div>
          )}

          {/* Category Badge */}
          <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-md px-3 py-1 text-xs font-semibold text-[#3d281c] shadow-xs border border-stone-200/50 pointer-events-none z-10">
            {product.category}
          </span>

          {/* Photo Count Pill */}
          {displayImages.length > 1 && (
            <span className="absolute top-3 right-3 rounded-full bg-black/75 backdrop-blur-md text-white px-2.5 py-1 text-[11px] font-medium flex items-center gap-1.5 shadow-md pointer-events-none z-10">
              <span>📷</span>
              <span>{displayImages.length} photos</span>
            </span>
          )}

          {/* Hover to view overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 pointer-events-none">
            <span className="rounded-full bg-white/95 backdrop-blur-xs px-3.5 py-1.5 text-xs font-semibold text-[#3d281c] shadow-md flex items-center gap-1.5">
              🔍 Click to view{" "}
              {displayImages.length > 1
                ? `all ${displayImages.length} photos`
                : "details"}
            </span>
          </div>

          {/* Interactive Prev/Next for Multiple Images */}
          {displayImages.length > 1 && (
            <div className="absolute bottom-2.5 inset-x-2 flex items-center justify-between pointer-events-none z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) =>
                    prev === 0 ? displayImages.length - 1 : prev - 1
                  );
                }}
                className="pointer-events-auto h-7 w-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition backdrop-blur-xs text-sm active:scale-95 shadow cursor-pointer"
                title="Previous photo"
                aria-label="Previous photo"
              >
                ‹
              </button>

              <div className="flex items-center gap-1 bg-black/50 backdrop-blur-xs px-2 py-1 rounded-full">
                {displayImages.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveImageIndex(idx);
                    }}
                    className={`pointer-events-auto transition-all cursor-pointer ${
                      idx === activeImageIndex
                        ? "w-4 h-1.5 rounded-full bg-white"
                        : "w-1.5 h-1.5 rounded-full bg-white/50 hover:bg-white/80"
                    }`}
                    aria-label={`Go to photo ${idx + 1}`}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveImageIndex((prev) =>
                    prev === displayImages.length - 1 ? 0 : prev + 1
                  );
                }}
                className="pointer-events-auto h-7 w-7 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition backdrop-blur-xs text-sm active:scale-95 shadow cursor-pointer"
                title="Next photo"
                aria-label="Next photo"
              >
                ›
              </button>
            </div>
          )}
        </div>

        {/* Content Details */}
        <div className="p-5">
          {/* Price & SKU snippet Row (Upper Side) */}
          <div className="flex items-center justify-between gap-2 mb-2">
            {priceData.isBadge ? (
              <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200/60">
                ✨ {priceData.text}
              </span>
            ) : (
              <span className="text-xl font-serif font-bold text-[#3d281c] tracking-tight">
                {priceData.text}
              </span>
            )}

            {product.id && (
              <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                #{product.id.slice(0, 6)}
              </span>
            )}
          </div>

          {/* Product Name */}
          <h4
            onClick={() => onView(activeImageIndex)}
            className="font-serif font-semibold text-[#3d281c] text-base leading-snug line-clamp-2 min-h-[2.75rem] group-hover:text-[#7a5235] hover:underline cursor-pointer transition"
            title={`Click to view details for ${product.name}`}
          >
            {product.name}
          </h4>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-500 mt-1.5 line-clamp-2 min-h-[2.5rem] leading-relaxed">
            {product.description || "No description provided."}
          </p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="px-5 py-3.5 bg-[#faf7f2]/70 border-t border-[#f0e6d8] flex items-center gap-2 mt-auto">
        <button
          type="button"
          onClick={() => onView(activeImageIndex)}
          className="inline-flex items-center justify-center gap-1 py-2 px-3 rounded-xl text-xs font-semibold text-[#3d281c] bg-white hover:bg-[#f5efe6] border border-[#d8c7b3] transition duration-150 active:scale-98 shadow-2xs cursor-pointer"
          title="View product photos and details"
        >
          <span>🔍</span>
          <span>View</span>
        </button>

        <a
          href={`/custom-furniture?design=${encodeURIComponent(product.id)}`}
          className="flex-1 inline-flex items-center justify-center py-2 px-3 rounded-xl text-xs font-semibold text-[#5a3927] bg-white hover:bg-[#f5efe6] border border-[#d8c7b3] transition duration-150 active:scale-98 shadow-2xs text-center"
        >
          Custom
        </a>

        <button
          type="button"
          onClick={onBuyNow}
          className="flex-1 inline-flex items-center justify-center py-2 px-3 rounded-xl text-xs font-semibold text-white bg-[#29251f] hover:bg-[#7a5235] transition duration-150 active:scale-98 shadow-2xs cursor-pointer"
        >
          Buy Now
        </button>
      </div>
    </article>
  );
}
