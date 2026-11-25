"use client";

import React, { useState, useEffect } from "react";
import { formatPrice } from "@/utils/product-images";

export type ShareableProduct = {
  id: string;
  name: string;
  category?: string;
  price?: string;
  image?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  description?: string | null;
};

interface ProductShareModalProps {
  product: ShareableProduct | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProductShareModal({
  product,
  isOpen,
  onClose,
}: ProductShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState("");

  useEffect(() => {
    if (product && typeof window !== "undefined") {
      const origin = window.location.origin;
      const url = `${origin}/furniture?product=${encodeURIComponent(product.id)}`;
      setShareUrl(url);
      setCopied(false);
    }
  }, [product]);

  if (!isOpen || !product) return null;

  const priceText = formatPrice(product.price).text;
  const displayImage =
    product.images?.[0] || product.image || product.image_url || "/Gavika-new-logo.png";

  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        // Fallback for non-https or older browsers
        const textArea = document.createElement("textarea");
        textArea.value = shareUrl;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
  };

  const handleWhatsAppShare = () => {
    const message = `Check out *${product.name}* (${product.category || "Furniture"}) on Gavika Furnitech!\n\nPrice: ${priceText}\n\nView design & photos:\n${shareUrl}`;
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${product.name} | Gavika Furnitech`,
          text: `Check out ${product.name} on Gavika Furnitech - ${priceText}`,
          url: shareUrl,
        });
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Native share failed:", err);
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const hasNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white p-5 sm:p-6 text-[#29251f] shadow-2xl border border-[#e5dcd0] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#f0e8dc]">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f4eee5] text-[#8b5e3c]">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
            </span>
            <h3 className="font-serif text-lg font-bold text-[#29251f]">
              Share Product
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Product Preview Snippet */}
        <div className="mt-4 flex items-center gap-3.5 rounded-xl bg-[#faf6f0] p-3 border border-[#ede3d5]">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-white border border-[#e3d7c7]">
            <img
              src={displayImage}
              alt={product.name}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8b5e3c]">
                {product.category || "Furniture"}
              </span>
              <span className="text-[10px] text-gray-400 font-mono">
                #{product.id.slice(0, 6)}
              </span>
            </div>
            <h4 className="font-serif font-semibold text-[#29251f] text-sm truncate">
              {product.name}
            </h4>
            <p className="text-xs font-bold text-[#8b5e3c] mt-0.5">
              {priceText}
            </p>
          </div>
        </div>

        {/* Share Actions */}
        <div className="mt-5 space-y-3">
          {/* WhatsApp Share Button (Highest Priority in India) */}
          <button
            type="button"
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white py-2.5 px-4 font-semibold text-sm shadow-xs transition duration-150 active:scale-98 cursor-pointer"
          >
            <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
              <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824zm-3.392-10.416c-4.418 0-8 3.582-8 8 0 1.488.409 2.88 1.121 4.075l-1.16 4.169 4.29-1.125c1.144.662 2.474 1.041 3.89 1.041 4.418 0 8-3.582 8-8s-3.582-8-8-8z" />
            </svg>
            <span>Share on WhatsApp</span>
          </button>

          {/* Native Share (if available on mobile/device) */}
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 py-2.5 px-4 font-semibold text-sm transition duration-150 active:scale-98 cursor-pointer"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>More Share Options</span>
            </button>
          )}

          {/* Copy Direct Link Box */}
          <div>
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Direct Product Link
            </label>
            <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 p-1.5 focus-within:border-[#8b5e3c] focus-within:bg-white transition">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="w-full bg-transparent px-2 text-xs text-gray-700 outline-none truncate font-mono select-all"
                onFocus={(e) => e.target.select()}
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className={`shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 flex items-center gap-1 cursor-pointer ${
                  copied
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "bg-[#8b5e3c] text-white hover:bg-[#6b4428]"
                }`}
              >
                {copied ? (
                  <>
                    <span>✓</span>
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            {copied && (
              <p className="mt-1.5 text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                <span>✓</span> Link copied to clipboard! Anyone opening this link will see this product directly.
              </p>
            )}
          </div>
        </div>

        {/* Helper Note */}
        <p className="mt-4 text-[11px] text-gray-400 text-center leading-relaxed">
          Opening this link will automatically open this design with full high-resolution photos and details.
        </p>
      </div>
    </div>
  );
}
