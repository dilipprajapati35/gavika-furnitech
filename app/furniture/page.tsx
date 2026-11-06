"use client";

import { extractProductImages, formatPrice } from "@/utils/product-images";
import { locationData } from "@/data/locations";
import { supabase } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ProductCard from "@/components/ProductCard";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  image: string;
  images: string[];
};

export default function FurniturePage() {
  const router = useRouter();

  const [productsList, setProductsList] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [categories, setCategories] = useState<string[]>(["All"]);
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [userId, setUserId] = useState("");

  const [cardActiveIndices, setCardActiveIndices] = useState<Record<string, number>>({});
  const [galleryProduct, setGalleryProduct] = useState<{
    product: Product;
    activeIndex: number;
  } | null>(null);

  const touchCardStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
  const touchModalStartRef = useRef<{ x: number; y: number } | null>(null);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [successRequestId, setSuccessRequestId] = useState("");
  const [error, setError] = useState("");

  // Razorpay Checkout State
  const [checkoutProduct, setCheckoutProduct] = useState<Product | null>(null);
  const [checkoutCustomer, setCheckoutCustomer] = useState({
    name: "",
    email: "",
    mobile: "",
    country: "India",
    state: "",
    city: "",
    customCity: "",
    address: "",
    pincode: "",
  });

  const checkoutCountries = Object.keys(locationData);
  const checkoutAvailableStates =
    checkoutCustomer.country && locationData[checkoutCustomer.country]
      ? Object.keys(locationData[checkoutCustomer.country])
      : [];
  const checkoutAvailableCities =
    checkoutCustomer.country &&
    checkoutCustomer.state &&
    locationData[checkoutCustomer.country]?.[checkoutCustomer.state]
      ? locationData[checkoutCustomer.country][checkoutCustomer.state]
      : [];

  const [checkoutErrors, setCheckoutErrors] = useState<Record<string, string>>({});
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentSuccess, setPaymentSuccess] = useState<{
    orderNumber: string;
    paymentId: string;
    productName: string;
    amount: number;
  } | null>(null);

  async function handleBuyNow(product: Product) {
    const cleanNum = product.price.replace(/[^\d.]/g, "");
    if (!cleanNum || isNaN(Number(cleanNum)) || Number(cleanNum) <= 0) {
      alert(
        `"${product.name}" pricing is upon custom quotation. Please click "Custom" to submit your specifications.`
      );
      return;
    }

    // Require user login before purchasing
    let currentUser = sessionUser;
    if (!currentUser) {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        currentUser = session.user;
        setSessionUser(session.user);
        setUserId(session.user.id);
      }
    }

    if (!currentUser) {
      const returnUrl = `/furniture?buy=${encodeURIComponent(product.id)}`;
      router.push(
        `/login?redirect=${encodeURIComponent(returnUrl)}&reason=buy&productName=${encodeURIComponent(product.name)}`
      );
      return;
    }

    setCheckoutProduct(product);
    setCheckoutError("");
    setCheckoutErrors({});

    setCheckoutCustomer((prev) => ({
      name:
        (currentUser?.user_metadata as any)?.full_name ||
        prev.name ||
        "",
      email: currentUser?.email || prev.email || "",
      mobile:
        (currentUser?.user_metadata as any)?.mobile ||
        currentUser?.phone ||
        prev.mobile ||
        "",
      country: prev.country || "India",
      state: prev.state || "",
      city: prev.city || "",
      customCity: prev.customCity || "",
      address: prev.address || "",
      pincode: prev.pincode || "",
    }));
  }

  const loadRazorpayScript = () => {
    return new Promise<boolean>((resolve) => {
      if (typeof window !== "undefined" && (window as any).Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  async function handleProceedToPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!checkoutProduct) return;

    const errors: Record<string, string> = {};
    if (!checkoutCustomer.name.trim()) errors.name = "Full Name is required.";
    let cleanPhone = checkoutCustomer.mobile.replace(/\D/g, "");
    if (cleanPhone.startsWith("91") && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(2);
    } else if (cleanPhone.startsWith("0") && cleanPhone.length > 10) {
      cleanPhone = cleanPhone.slice(1);
    }
    if (!cleanPhone || cleanPhone.length !== 10) {
      errors.mobile = "Please enter a valid 10-digit mobile number.";
    }
    if (
      !checkoutCustomer.email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(checkoutCustomer.email.trim())
    ) {
      errors.email = "Please enter a valid email address.";
    }
    if (!checkoutCustomer.country) {
      errors.country = "Please select Country.";
    }
    if (!checkoutCustomer.state) {
      errors.state = "Please select State.";
    }
    const effectiveCity =
      checkoutCustomer.city === "Other"
        ? checkoutCustomer.customCity.trim()
        : checkoutCustomer.city.trim();
    if (!effectiveCity) {
      errors.city = "Please select or enter City.";
    }
    if (!checkoutCustomer.address.trim()) {
      errors.address = "Flat / House No. & Street address is required.";
    }
    if (!/^\d{6}$/.test(checkoutCustomer.pincode.trim())) {
      errors.pincode = "Enter a valid 6-digit PIN code.";
    }

    if (Object.keys(errors).length > 0) {
      setCheckoutErrors(errors);
      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const cleanNum = checkoutProduct.price.replace(/[^\d.]/g, "");
      const amount = Number(cleanNum);
      const amountInPaise = Math.round(amount * 100);

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setCheckoutError("Failed to load Razorpay payment SDK. Please check your internet connection.");
        setCheckoutLoading(false);
        return;
      }

      const fullDeliveryAddress = [
        checkoutCustomer.address.trim(),
        effectiveCity,
        checkoutCustomer.state.trim(),
        checkoutCustomer.pincode.trim() ? `PIN: ${checkoutCustomer.pincode.trim()}` : "",
        checkoutCustomer.country.trim(),
      ]
        .filter(Boolean)
        .join(", ");

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: "INR",
          receipt: `rcpt_${checkoutProduct.id.slice(0, 8)}_${Date.now()}`,
          notes: {
            productId: checkoutProduct.id,
            productName: checkoutProduct.name,
            customerName: checkoutCustomer.name,
            customerPhone: cleanPhone,
            customerEmail: checkoutCustomer.email,
            deliveryAddress: fullDeliveryAddress,
            userId: userId || sessionUser?.id || "",
          },
        }),
      });

      const orderData = await res.json();

      if (!res.ok || !orderData.success) {
        setCheckoutError(orderData.error || "Failed to create payment order with Razorpay.");
        setCheckoutLoading(false);
        return;
      }

      const options = {
        key: orderData.key_id || orderData.keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency || "INR",
        name: "Gavika Furnitech",
        description: `Order: ${checkoutProduct.name}`,
        image: "/Gavika-new-logo.png",
        order_id: orderData.order_id || orderData.orderId,
        prefill: {
          name: checkoutCustomer.name,
          email: checkoutCustomer.email,
          contact: cleanPhone,
        },
        theme: {
          color: "#3d281c",
        },
        handler: async function (response: any) {
          try {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const currentUserId = session?.user?.id || userId || sessionUser?.id || null;
            const userAccessToken = session?.access_token || null;

            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                access_token: userAccessToken,
                orderDetails: {
                  product_id: checkoutProduct.id,
                  product_name: checkoutProduct.name,
                  product_image:
                    checkoutProduct.images?.[0] ||
                    checkoutProduct.image ||
                    null,
                  amount,
                  user_id: currentUserId,
                  delivery_address: fullDeliveryAddress,
                  customer_name: checkoutCustomer.name,
                  customer_mobile: cleanPhone,
                  customer_email: checkoutCustomer.email,
                },
              }),
            });

            const verifyData = await verifyRes.json();

            if (verifyRes.ok && verifyData.success) {
              const finalOrderNumber = verifyData.orderNumber;

              // Client-side confirmation: make sure order and custom_requests exist under this user's account
              if (currentUserId) {
                try {
                  const { data: existingOrd } = await supabase
                    .from("orders")
                    .select("id")
                    .eq("order_number", finalOrderNumber)
                    .maybeSingle();

                  if (!existingOrd) {
                    const reqNumber = `REQ-${Date.now().toString().slice(-6)}`;
                    const { data: clientReq } = await supabase
                      .from("custom_requests")
                      .insert({
                        request_id: reqNumber,
                        user_id: currentUserId,
                        full_name: checkoutCustomer.name,
                        mobile: cleanPhone,
                        email: checkoutCustomer.email,
                        furniture_type: checkoutProduct.name,
                        catalogue_design_name: checkoutProduct.name,
                        catalogue_design_id: checkoutProduct.id,
                        catalogue_design_image_url:
                          checkoutProduct.images?.[0] || checkoutProduct.image || null,
                        delivery_location: fullDeliveryAddress,
                        requirement: `Direct online purchase via Razorpay (Payment: ${response.razorpay_payment_id})`,
                        status: "Order Confirmed",
                      })
                      .select("id")
                      .maybeSingle();

                    await supabase.from("orders").insert({
                      order_number: finalOrderNumber,
                      user_id: currentUserId,
                      request_id: clientReq?.id || null,
                      amount,
                      status: "Confirmed",
                      payment_status: "paid",
                      razorpay_order_id: response.razorpay_order_id || null,
                      razorpay_payment_id: response.razorpay_payment_id || null,
                      delivery_address: fullDeliveryAddress,
                    });
                  }
                } catch (clientSyncErr) {
                  console.warn("Client-side order sync note:", clientSyncErr);
                }
              }

              setCheckoutProduct(null);
              setPaymentSuccess({
                orderNumber: finalOrderNumber,
                paymentId: response.razorpay_payment_id,
                productName: checkoutProduct.name,
                amount,
              });
            } else {
              setCheckoutError(verifyData.error || "Payment verification failed.");
            }
          } catch (err: any) {
            setCheckoutError("Error verifying payment: " + err.message);
          } finally {
            setCheckoutLoading(false);
          }
        },
        modal: {
          ondismiss: function () {
            setCheckoutLoading(false);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on("payment.failed", function (response: any) {
        setCheckoutError(`Payment failed: ${response.error?.description || "Transaction declined"}`);
        setCheckoutLoading(false);
      });
      razorpayInstance.open();
    } catch (err: any) {
      console.error("Razorpay exception:", err);
      setCheckoutError(err.message || "An unexpected error occurred.");
      setCheckoutLoading(false);
    }
  }

  const nextGalleryImage = useCallback(() => {
    setGalleryProduct((prev) => {
      if (!prev) return null;
      const total = prev.product.images?.length || 1;
      return {
        ...prev,
        activeIndex: (prev.activeIndex + 1) % total,
      };
    });
  }, []);

  const prevGalleryImage = useCallback(() => {
    setGalleryProduct((prev) => {
      if (!prev) return null;
      const total = prev.product.images?.length || 1;
      return {
        ...prev,
        activeIndex: (prev.activeIndex - 1 + total) % total,
      };
    });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user || null);
      if (session?.user) {
        setUserId(session.user.id);
        supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", session.user.id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setIsAdmin(true);
          });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null);
      setUserId(session?.user?.id || "");
      if (!session?.user) {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Keyboard navigation for image gallery modal
  useEffect(() => {
    if (!galleryProduct) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGalleryProduct(null);
      } else if (e.key === "ArrowLeft") {
        prevGalleryImage();
      } else if (e.key === "ArrowRight") {
        nextGalleryImage();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [galleryProduct, nextGalleryImage, prevGalleryImage]);

  useEffect(() => {
    async function loadData() {
      try {
        const [productsRes, typesRes] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("furniture_types")
            .select("name")
            .order("name", { ascending: true }),
        ]);

        if (!productsRes.error && productsRes.data) {
          setProductsList(
            productsRes.data.map((p) => {
              const images = extractProductImages(p);
              return {
                id: p.id,
                name: p.name,
                category: p.category,
                description: p.description || "",
                price: p.price || "Custom Quote",
                image: images[0] || p.image_url || "/placeholder.jpg",
                images: images.length > 0 ? images : [p.image_url || "/placeholder.jpg"],
              };
            })
          );
        }

        if (!typesRes.error && typesRes.data) {
          const typeNames = typesRes.data
            .map((item: { name: string }) => item.name)
            .filter(Boolean);
          setCategories(["All", ...typeNames]);
        }
      } catch (err) {
        console.error("Failed to load furniture data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Auto-open checkout modal if returning from login with ?buy=<productId>
  useEffect(() => {
    if (typeof window === "undefined" || !productsList.length || !sessionUser) return;
    const params = new URLSearchParams(window.location.search);
    const buyProductId = params.get("buy");
    if (!buyProductId) return;

    const targetProduct = productsList.find((p) => p.id === buyProductId);
    if (targetProduct) {
      handleBuyNow(targetProduct);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [productsList, sessionUser]);

  const filteredProducts =
    selectedCategory === "All"
      ? productsList
      : productsList.filter(
        (product) =>
          product.category?.trim().toLowerCase() ===
          selectedCategory.trim().toLowerCase()
      );

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#29251f]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#ded5c8] bg-[#f8f5ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/Gavika-new-logo.png"
              alt="Gavika Furnitech"
              className="h-14 w-auto object-contain"
            />

            <div>
              <p className="text-xl font-semibold tracking-wide text-[#29251f]">
                Gavika Furnitech
              </p>
              <p className="text-xs tracking-[0.2em] text-[#8b6f47]">
                PREMIUM FURNITURE
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm font-medium md:flex">
            <a href="/" className="hover:text-[#8b6f47]">
              Home
            </a>

            <a href="/furniture" className="text-[#8b6f47] font-semibold">
              Furniture
            </a>

            <a href="/custom-furniture" className="hover:text-[#8b6f47]">
              Custom Furniture
            </a>

            <a href="/#process" className="hover:text-[#8b6f47]">
              About
            </a>

            <a href="/#contact" className="hover:text-[#8b6f47]">
              Contact
            </a>

            {userId ? (
              <div className="flex items-center gap-3">
                <a
                  href={isAdmin ? "/admin/dashboard" : "/account"}
                  className="font-semibold text-[#8b6f47] flex items-center gap-1.5 hover:text-[#5a3927] transition"
                >
                  <span>👤</span>
                  <span>{isAdmin ? "Admin Dashboard" : "My Account"}</span>
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace("/login?logged_out=true");
                  }}
                  className="text-xs text-gray-400 hover:text-red-600 transition"
                >
                  Logout
                </button>
              </div>
            ) : (
              <a href="/login" className="hover:text-[#8b6f47]">
                Login
              </a>
            )}
          </nav>

          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden rounded-lg border border-[#ded5c8] px-3 py-2 text-xl"
            aria-label="Open menu"
          >
            {mobileMenuOpen ? "✕" : "☰"}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#ded5c8] bg-[#f8f5ef] px-6 py-4">
            <nav className="flex flex-col gap-4 text-sm font-medium">
              <a
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Home
              </a>

              <a
                href="/furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#8b6f47] font-semibold"
              >
                Furniture
              </a>

              <a
                href="/custom-furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Custom Furniture
              </a>

              <a
                href="/#process"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                About
              </a>

              <a
                href="/#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b6f47]"
              >
                Contact
              </a>

              {userId ? (
                <div className="flex flex-col gap-2 pt-2 border-t border-[#ded5c8]">
                  <a
                    href={isAdmin ? "/admin/dashboard" : "/account"}
                    onClick={() => setMobileMenuOpen(false)}
                    className="font-semibold text-[#8b6f47]"
                  >
                    👤 {isAdmin ? "Admin Dashboard" : "My Account"}
                  </a>
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.auth.signOut();
                      router.replace("/login?logged_out=true");
                    }}
                    className="text-left text-xs text-red-600 hover:underline"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <a
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="hover:text-[#8b6f47]"
                >
                  Login
                </a>
              )}
            </nav>
          </div>
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-20">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.3em] text-[#9a7748]">
            Gavika Furnitech
          </p>

          <h1 className="text-5xl font-semibold leading-tight md:text-6xl">
            Furniture Made
            <br />
            <span className="text-[#8b6f47]">For Your Space.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-8 text-[#746c62]">
            Explore our furniture collection and discover designs created for
            modern, comfortable and beautiful spaces.
          </p>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex items-center gap-2.5 border-b border-[#ded5c8] pb-4 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {categories.map((category) => {
            const count =
              category === "All"
                ? productsList.length
                : productsList.filter(
                  (p) =>
                    p.category?.trim().toLowerCase() ===
                    category.trim().toLowerCase()
                ).length;

            const isSelected = selectedCategory === category;

            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-xl font-medium text-xs sm:text-sm transition shrink-0 whitespace-nowrap ${isSelected
                    ? "bg-[#3d281c] text-white shadow-sm"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-[#e7dccd]"
                  }`}
              >
                <span>{category}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] sm:text-xs font-semibold ${isSelected
                      ? "bg-[#7a5235] text-white"
                      : "bg-[#f5efe6] text-[#7a5235]"
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div className="mb-10 flex items-end justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#9a7748]">
              Our Collection
            </p>

            <h2 className="mt-2 text-3xl font-semibold">
              Explore Our Designs
            </h2>
          </div>

          <p className="hidden text-sm text-[#746c62] md:block">
            {loading ? "Loading..." : `${filteredProducts.length} designs`}
          </p>
        </div>

        {loading ? (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-2xl border border-[#e2dbcf] bg-white p-0 shadow-xs animate-pulse"
              >
                <div className="aspect-[4/3] bg-[#eee8de]" />
                <div className="p-6 space-y-4">
                  <div className="h-6 w-3/4 rounded-md bg-[#e2dbcf]" />
                  <div className="space-y-2">
                    <div className="h-4 w-full rounded bg-[#ede7dc]" />
                    <div className="h-4 w-2/3 rounded bg-[#ede7dc]" />
                  </div>
                  <div className="pt-2 flex justify-between items-center">
                    <div className="h-4 w-20 rounded bg-[#e2dbcf]" />
                    <div className="h-9 w-24 rounded-full bg-[#e2dbcf]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="py-20 text-center rounded-2xl bg-white border border-[#e2dbcf] p-8">
            <div className="text-4xl mb-3">🛋️</div>
            <h3 className="text-xl font-semibold text-[#29251f]">No designs found</h3>
            <p className="text-sm text-[#746c62] mt-1">
              There are no products listed under the &quot;{selectedCategory}&quot; category yet.
            </p>
          </div>
        ) : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id || product.name}
                product={product}
                onView={(activeIndex) =>
                  setGalleryProduct({ product, activeIndex })
                }
                onBuyNow={() => handleBuyNow(product)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Product Gallery Modal (High-Res Multi-Image Viewer, Full Uncropped Photo View) */}
      {galleryProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md p-2 sm:p-4 md:p-6"
          onClick={() => setGalleryProduct(null)}
        >
          <div
            className="relative w-full max-w-5xl lg:max-w-6xl xl:max-w-7xl overflow-hidden rounded-2xl sm:rounded-3xl bg-[#1c1917] text-white shadow-2xl flex flex-col max-h-[96vh] sm:max-h-[95vh] border border-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-6 sm:py-3.5 bg-[#141210]">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#8b6f47]/30 border border-[#8b6f47]/50 px-2.5 py-0.5 text-[10px] sm:text-xs font-medium text-[#d8bd91]">
                    {galleryProduct.product.category}
                  </span>
                  <span className="text-[11px] sm:text-xs text-white/50">
                    Photo {galleryProduct.activeIndex + 1} of{" "}
                    {galleryProduct.product.images?.length || 1}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-white mt-0.5 truncate">
                  {galleryProduct.product.name}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                {/* Direct Full-Res Original Link */}
                <a
                  href={
                    galleryProduct.product.images?.[galleryProduct.activeIndex] ||
                    galleryProduct.product.image ||
                    (galleryProduct.product as any).image_url ||
                    "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white px-3 py-1 text-xs font-medium transition"
                  title="Open original high-res photo in full size"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Full Size ⤢</span>
                </a>

                <button
                  type="button"
                  onClick={() => setGalleryProduct(null)}
                  className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 active:bg-white/30 hover:text-white transition"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Main Image Showcase: 100% Full Uncropped Image */}
            <div
              onTouchStart={(e) => {
                touchModalStartRef.current = {
                  x: e.touches[0].clientX,
                  y: e.touches[0].clientY,
                };
              }}
              onTouchEnd={(e) => {
                if (!touchModalStartRef.current) return;
                const diffX = touchModalStartRef.current.x - e.changedTouches[0].clientX;
                const diffY = touchModalStartRef.current.y - e.changedTouches[0].clientY;
                if (Math.abs(diffX) > 35 && Math.abs(diffX) > Math.abs(diffY)) {
                  if (diffX > 0) {
                    nextGalleryImage();
                  } else {
                    prevGalleryImage();
                  }
                }
                touchModalStartRef.current = null;
              }}
              className="relative flex-1 flex items-center justify-center bg-black/85 p-2 sm:p-4 min-h-[300px] max-h-[68vh] sm:max-h-[75vh] overflow-hidden select-none touch-pan-y"
            >
              <img
                src={
                  galleryProduct.product.images?.[galleryProduct.activeIndex] ||
                  galleryProduct.product.image
                }
                alt={`${galleryProduct.product.name} preview`}
                className="max-h-[66vh] sm:max-h-[73vh] max-w-full w-auto h-auto object-contain rounded-xl shadow-2xl transition-all duration-300"
              />

              {/* Prev / Next buttons in modal */}
              {(galleryProduct.product.images?.length || 0) > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevGalleryImage}
                    className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 active:scale-90 transition shadow-lg text-xl sm:text-2xl font-bold z-20 cursor-pointer"
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={nextGalleryImage}
                    className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 flex h-9 w-9 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/90 active:scale-90 transition shadow-lg text-xl sm:text-2xl font-bold z-20 cursor-pointer"
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}
            </div>

            {/* Thumbnails Strip (Uncropped previews) */}
            {(galleryProduct.product.images?.length || 0) > 1 && (
              <div className="border-t border-white/10 bg-[#141210] px-3 py-2 sm:px-6 sm:py-2.5">
                <div className="flex items-center justify-start sm:justify-center gap-2 sm:gap-3 overflow-x-auto py-1 scrollbar-none snap-x">
                  {galleryProduct.product.images.map((imgUrl, idx) => {
                    const isCurrent = idx === galleryProduct.activeIndex;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          setGalleryProduct((prev) =>
                            prev ? { ...prev, activeIndex: idx } : null
                          )
                        }
                        className={`relative h-14 w-20 sm:h-16 sm:w-24 flex-shrink-0 snap-center overflow-hidden rounded-lg border-2 bg-black/50 transition-all duration-200 ${
                          isCurrent
                            ? "border-[#d8bd91] ring-2 ring-[#d8bd91]/50 scale-105"
                            : "border-white/20 opacity-60 hover:opacity-100"
                        }`}
                      >
                        <img
                          src={imgUrl}
                          alt={`Thumbnail ${idx + 1}`}
                          className="h-full w-full object-contain p-0.5"
                        />
                        {isCurrent && (
                          <div className="absolute inset-0 bg-[#d8bd91]/15 pointer-events-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Modal Footer with Product Summary & Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-white/10 bg-[#1c1917] px-4 py-2.5 sm:px-6 sm:py-3.5">
              <div className="text-left">
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#d8bd91] font-semibold">
                    Price:
                  </span>
                  <span className="text-xs sm:text-sm font-bold text-white">
                    {formatPrice(galleryProduct.product.price).text}
                  </span>
                </div>
                {galleryProduct.product.description && (
                  <p className="text-[11px] sm:text-xs text-white/70 line-clamp-1 max-w-md mt-0.5">
                    {galleryProduct.product.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setGalleryProduct(null)}
                  className="flex-1 sm:flex-initial text-center rounded-xl border border-white/20 px-4 py-2 sm:py-1.5 text-xs font-semibold text-white/80 active:bg-white/20 hover:bg-white/10 transition"
                >
                  Close
                </button>
                <a
                  href={`/custom-furniture?design=${encodeURIComponent(galleryProduct.product.id)}`}
                  className="flex-1 sm:flex-initial text-center rounded-xl border border-[#d8bd91]/40 text-[#d8bd91] hover:bg-[#8b6f47]/30 px-4 py-2 sm:py-1.5 text-xs font-semibold shadow-sm transition"
                >
                  Custom
                </a>
                <button
                  type="button"
                  onClick={() => {
                    const prod = galleryProduct.product;
                    setGalleryProduct(null);
                    handleBuyNow(prod);
                  }}
                  className="flex-1 sm:flex-initial text-center rounded-xl bg-white hover:bg-[#f5efe6] text-[#29251f] px-5 py-2 sm:py-1.5 text-xs font-semibold shadow-sm transition flex items-center justify-center gap-1.5"
                >
                  <span>Buy Now</span>
                  <span>💳</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Checkout & Delivery Details Modal */}
      {checkoutProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            if (!checkoutLoading) setCheckoutProduct(null);
          }}
        >
          <div
            className="relative w-full max-w-xl rounded-2xl bg-white text-[#29251f] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#eee8de] px-4 sm:px-6 py-3.5 sm:py-4 bg-[#faf7f2] shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-serif font-semibold text-[#29251f]">
                  Complete Your Order
                </h3>
                <p className="text-xs text-gray-500">
                  Instant secure payment via Razorpay
                </p>
              </div>

              <button
                type="button"
                disabled={checkoutLoading}
                onClick={() => setCheckoutProduct(null)}
                className="h-8 w-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center justify-center transition disabled:opacity-50 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Product Summary Row */}
            <div className="p-3.5 sm:p-5 border-b border-[#eee8de] bg-[#fbf9f5] flex items-center gap-3 sm:gap-4 shrink-0">
              <img
                src={checkoutProduct.image}
                alt={checkoutProduct.name}
                className="h-14 w-16 sm:h-16 sm:w-20 rounded-xl object-cover border border-[#e2dbcf] shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#8b6f47]">
                  {checkoutProduct.category}
                </span>
                <h4 className="text-sm font-semibold text-[#29251f] truncate">
                  {checkoutProduct.name}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Handcrafted with premium timber & finish
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[11px] text-gray-400 block">Total Amount</span>
                <span className="text-base sm:text-lg font-serif font-bold text-[#8b6f47]">
                  {checkoutProduct.price.startsWith("₹")
                    ? checkoutProduct.price
                    : `₹${Number(checkoutProduct.price.replace(/[^\d.]/g, "")).toLocaleString("en-IN")}`}
                </span>
              </div>
            </div>

            {/* Checkout Form */}
            <form onSubmit={handleProceedToPayment} className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto">
              {checkoutError && (
                <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-3.5 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <span>⚠️</span>
                    <span>Payment Configuration Notice</span>
                  </p>
                  <p>{checkoutError}</p>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {/* Customer Name */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutCustomer.name}
                    onChange={(e) => {
                      setCheckoutCustomer((prev) => ({ ...prev, name: e.target.value }));
                      if (checkoutErrors.name) {
                        setCheckoutErrors((prev) => ({ ...prev, name: "" }));
                      }
                    }}
                    placeholder="e.g. Rahul Sharma"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                      checkoutErrors.name
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  />
                  {checkoutErrors.name && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.name}</p>
                  )}
                </div>

                {/* Mobile Phone */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">
                      +91
                    </span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      value={checkoutCustomer.mobile}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "");
                        if (val.startsWith("91") && val.length > 10) {
                          val = val.slice(2);
                        } else if (val.startsWith("0") && val.length > 10) {
                          val = val.slice(1);
                        }
                        val = val.slice(0, 10);
                        setCheckoutCustomer((prev) => ({
                          ...prev,
                          mobile: val,
                        }));
                        if (checkoutErrors.mobile) {
                          setCheckoutErrors((prev) => ({ ...prev, mobile: "" }));
                        }
                      }}
                      placeholder="9876543210"
                      className={`w-full rounded-xl border pl-11 pr-3.5 py-2.5 text-sm outline-none transition ${
                        checkoutErrors.mobile
                          ? "border-red-500 bg-red-50/20"
                          : "border-gray-300 focus:border-[#8b6f47]"
                      }`}
                    />
                  </div>
                  {checkoutErrors.mobile && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.mobile}</p>
                  )}
                </div>

                {/* Email Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={checkoutCustomer.email}
                    onChange={(e) => {
                      setCheckoutCustomer((prev) => ({ ...prev, email: e.target.value }));
                      if (checkoutErrors.email) {
                        setCheckoutErrors((prev) => ({ ...prev, email: "" }));
                      }
                    }}
                    placeholder="rahul@example.com"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                      checkoutErrors.email
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  />
                  {checkoutErrors.email && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.email}</p>
                  )}
                </div>

                {/* Delivery Street Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Flat / House No. & Street Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={checkoutCustomer.address}
                    onChange={(e) => {
                      setCheckoutCustomer({ ...checkoutCustomer, address: e.target.value });
                      if (checkoutErrors.address) {
                        setCheckoutErrors((prev) => ({ ...prev, address: "" }));
                      }
                    }}
                    placeholder="Flat / House No., Building Name, Street, Landmark"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                      checkoutErrors.address
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  />
                  {checkoutErrors.address && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.address}</p>
                  )}
                </div>

                {/* Country Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    Country <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={checkoutCustomer.country}
                    onChange={(e) => {
                      const newCountry = e.target.value;
                      setCheckoutCustomer({
                        ...checkoutCustomer,
                        country: newCountry,
                        state: "",
                        city: "",
                        customCity: "",
                      });
                      if (checkoutErrors.country) {
                        setCheckoutErrors((prev) => ({ ...prev, country: "" }));
                      }
                    }}
                    required
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition cursor-pointer ${
                      checkoutErrors.country
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  >
                    <option value="">Select Country</option>
                    {checkoutCountries.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  {checkoutErrors.country && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.country}</p>
                  )}
                </div>

                {/* State Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    State / Province <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={checkoutCustomer.state}
                    onChange={(e) => {
                      const newState = e.target.value;
                      setCheckoutCustomer({
                        ...checkoutCustomer,
                        state: newState,
                        city: "",
                        customCity: "",
                      });
                      if (checkoutErrors.state) {
                        setCheckoutErrors((prev) => ({ ...prev, state: "" }));
                      }
                    }}
                    disabled={!checkoutCustomer.country}
                    required
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${
                      checkoutErrors.state
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  >
                    <option value="">Select State</option>
                    {checkoutAvailableStates.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  {checkoutErrors.state && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.state}</p>
                  )}
                </div>

                {/* City Selection */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={checkoutCustomer.city}
                    onChange={(e) => {
                      const newCity = e.target.value;
                      setCheckoutCustomer({
                        ...checkoutCustomer,
                        city: newCity,
                        customCity: newCity === "Other" ? checkoutCustomer.customCity : "",
                      });
                      if (checkoutErrors.city) {
                        setCheckoutErrors((prev) => ({ ...prev, city: "" }));
                      }
                    }}
                    disabled={!checkoutCustomer.state}
                    required
                    className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm outline-none transition cursor-pointer disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed ${
                      checkoutErrors.city
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  >
                    <option value="">Select City</option>
                    {checkoutAvailableCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                    <option value="Other">Other City</option>
                  </select>
                  {checkoutErrors.city && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.city}</p>
                  )}
                </div>

                {/* PIN Code */}
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    PIN Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={6}
                    value={checkoutCustomer.pincode}
                    onChange={(e) => {
                      setCheckoutCustomer({
                        ...checkoutCustomer,
                        pincode: e.target.value.replace(/\D/g, "").slice(0, 6),
                      });
                      if (checkoutErrors.pincode) {
                        setCheckoutErrors((prev) => ({ ...prev, pincode: "" }));
                      }
                    }}
                    placeholder="e.g. 313001"
                    className={`w-full rounded-xl border px-3.5 py-2.5 text-sm outline-none transition ${
                      checkoutErrors.pincode
                        ? "border-red-500 bg-red-50/20"
                        : "border-gray-300 focus:border-[#8b6f47]"
                    }`}
                  />
                  {checkoutErrors.pincode && (
                    <p className="text-[11px] text-red-600 mt-1">{checkoutErrors.pincode}</p>
                  )}
                </div>

                {/* Custom City Input when "Other" is chosen */}
                {checkoutCustomer.city === "Other" && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Specify City Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={checkoutCustomer.customCity}
                      onChange={(e) => {
                        setCheckoutCustomer({
                          ...checkoutCustomer,
                          customCity: e.target.value,
                        });
                        if (checkoutErrors.city) {
                          setCheckoutErrors((prev) => ({ ...prev, city: "" }));
                        }
                      }}
                      placeholder="Enter your city name"
                      className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-sm outline-none focus:border-[#8b6f47] transition"
                    />
                  </div>
                )}
              </div>

              {/* Security & Trust Badges */}
              <div className="flex items-center justify-between pt-2 text-[11px] text-gray-500 border-t border-gray-100">
                <span className="flex items-center gap-1">
                  <span>🔒</span> 256-bit SSL Encrypted
                </span>
                <span className="flex items-center gap-1">
                  <span>🚚</span> White-Glove Delivery
                </span>
                <span className="flex items-center gap-1">
                  <span>🛡️</span> 100% Genuine Timber
                </span>
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={checkoutLoading}
                  className="w-full rounded-xl bg-[#29251f] hover:bg-[#8b6f47] text-white py-3.5 text-sm font-semibold transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-60 active:scale-98"
                >
                  {checkoutLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Razorpay...</span>
                    </>
                  ) : (
                    <>
                      <span>Proceed to Pay</span>
                      <span>•</span>
                      <span>
                        {checkoutProduct.price.startsWith("₹")
                          ? checkoutProduct.price
                          : `₹${Number(checkoutProduct.price.replace(/[^\d.]/g, "")).toLocaleString("en-IN")}`}
                      </span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Success Confirmation Modal */}
      {paymentSuccess && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setPaymentSuccess(null)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white text-center p-8 shadow-2xl border border-[#eee8de]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-3xl mx-auto mb-4">
              ✓
            </div>

            <h3 className="text-2xl font-serif font-bold text-[#29251f]">
              Payment Successful!
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Your order has been confirmed and placed with Gavika Furnitech.
            </p>

            <div className="mt-5 p-4 rounded-2xl bg-[#faf7f2] border border-[#eee8de] text-left space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Order Number:</span>
                <span className="font-mono font-bold text-[#29251f]">
                  {paymentSuccess.orderNumber}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payment ID:</span>
                <span className="font-mono text-gray-700">
                  {paymentSuccess.paymentId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Item:</span>
                <span className="font-semibold text-[#29251f] truncate max-w-[200px]">
                  {paymentSuccess.productName}
                </span>
              </div>
              <div className="flex justify-between pt-1 border-t border-gray-200">
                <span className="font-semibold text-gray-700">Amount Paid:</span>
                <span className="font-bold text-[#8b6f47] text-sm">
                  ₹{paymentSuccess.amount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {/* Live Delivery Progress Tracker */}
            <div className="mt-4 p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 text-left text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-amber-900 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Order Status: Confirmed
                </span>
                <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-bold">
                  Step 1 of 6
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1 text-[9px] text-center font-medium pt-1">
                <div className="bg-emerald-600 text-white rounded py-1 shadow-2xs">✓ Confirmed</div>
                <div className="bg-amber-100 text-amber-800 rounded py-1">Workshop</div>
                <div className="bg-white/80 text-gray-400 rounded py-1">QA Check</div>
                <div className="bg-white/80 text-gray-400 rounded py-1">Ready</div>
                <div className="bg-white/80 text-gray-400 rounded py-1">Dispatch</div>
                <div className="bg-white/80 text-gray-400 rounded py-1">Delivered</div>
              </div>
              <p className="text-[10px] text-amber-800/80 pt-0.5">
                Our workshop is preparing timber & materials. Admin will update fulfillment stages until delivered.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2.5">
              <a
                href={`/account?order=${encodeURIComponent(paymentSuccess.orderNumber)}`}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#29251f] hover:bg-[#8b6f47] text-white py-3 text-xs font-semibold transition active:scale-98 shadow-sm"
              >
                <span>📦</span>
                <span>Track Live Order in My Account</span>
                <span>→</span>
              </a>

              {isAdmin && (
                <a
                  href="/admin/dashboard?tab=orders"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#f5efe6] hover:bg-[#ede3d5] text-[#3d281c] border border-[#d8c7b3] py-2.5 text-xs font-semibold transition"
                >
                  <span>⚙️</span>
                  <span>View in Admin Dashboard (Manage & Mark Delivered)</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => setPaymentSuccess(null)}
                className="w-full rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-600 py-2.5 text-xs font-medium transition"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Furniture CTA */}
      <section className="mx-auto max-w-7xl px-6 pb-20">
        <div className="rounded-3xl bg-[#29251f] px-8 py-14 text-white md:px-14">
          <div className="max-w-3xl">
            <p className="text-sm uppercase tracking-[0.25em] text-[#d8bd91]">
              Need Something Different?
            </p>

            <h2 className="mt-4 text-4xl font-semibold md:text-5xl">
              Create Furniture
              <br />
              Made Just For You.
            </h2>

            <p className="mt-5 max-w-2xl leading-7 text-[#d6d0c7]">
              Tell us your requirements, dimensions and design preferences.
              Our team will help turn your idea into a professionally crafted
              piece of furniture.
            </p>

            <a
              href="/custom-furniture"
              className="mt-8 inline-block rounded-full bg-white px-7 py-3.5 font-semibold text-[#29251f] transition hover:bg-[#e9dfcf]"
            >
              Start Custom Request →
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#ded6c8] bg-[#eee8de]">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-6 py-10 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/Gavika-new-logo.png"
              alt="Gavika Furnitech"
              className="h-12 w-auto object-contain"
            />

            <div>
              <p className="font-semibold">Gavika Furnitech</p>
              <p className="text-xs text-[#746c62]">
                Udaipur, Rajasthan
              </p>
            </div>
          </div>

          <div className="text-sm text-[#746c62]">
            © {new Date().getFullYear()} Gavika Furnitech. All rights reserved.
          </div>
        </div>
      </footer>
    </main>
  );
}