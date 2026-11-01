"use client";
export const dynamic = "force-dynamic";
import { locationData } from "@/data/locations";
import { products } from "@/data/products";
import { extractProductImages } from "@/utils/product-images";
import { supabase } from "@/utils/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";

function generateRequestId() {
  const year = new Date().getFullYear();
  const randomNumber = Math.floor(1000 + Math.random() * 9000);

  return `GF-${year}-${randomNumber}`;
}

function CustomFurnitureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedDesign = searchParams.get("design");
  console.log("Selected Design:", selectedDesign);

  type SelectedDesignType = {
    id: string;
    name: string;
    category?: string;
    description?: string;
    price?: string;
    image?: string;
    images?: string[];
  };

  const [selectedProduct, setSelectedProduct] = useState<SelectedDesignType | null>(null);
  const [selectedDesignImageIndex, setSelectedDesignImageIndex] = useState(0);

  useEffect(() => {
    if (!selectedDesign) return;

    // Check static list first
    const staticFound = products.find((p) => p.id === selectedDesign);
    if (staticFound) {
      const imgs = (staticFound as any).images || (staticFound.image ? [staticFound.image] : []);
      setSelectedProduct({
        ...staticFound,
        images: imgs,
      });
      setSelectedDesignImageIndex(0);
      return;
    }

    // Check Supabase products table
    supabase
      .from("products")
      .select("*")
      .eq("id", selectedDesign)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const imgs = extractProductImages(data);
          setSelectedProduct({
            id: data.id,
            name: data.name,
            category: data.category,
            description: data.description || "",
            price: data.price || "Custom Quote",
            image: imgs[0] || data.image_url || "",
            images: imgs.length > 0 ? imgs : (data.image_url ? [data.image_url] : []),
          });
          setSelectedDesignImageIndex(0);
        }
      });
  }, [selectedDesign]);

  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");

  const [furnitureTypes, setFurnitureTypes] = useState<string[]>([]);
  const [materialPreferences, setMaterialPreferences] = useState<string[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const [checkingUser, setCheckingUser] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [successRequestId, setSuccessRequestId] = useState("");
  const [error, setError] = useState("");

  // Delivery Address Dropdowns
  const [selectedCountry, setSelectedCountry] = useState("India");
  const [selectedState, setSelectedState] = useState("");
  const [selectedCity, setSelectedCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [pincode, setPincode] = useState("");

  // Controlled form inputs with validation
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});

  const validateField = (field: string, val: string): string => {
    switch (field) {
      case "full_name": {
        const trimmed = val.trim();
        if (!trimmed) return "Full Name is required.";
        if (trimmed.length < 2) return "Full Name must be at least 2 characters.";
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
          return "Full Name should contain letters and spaces only.";
        }
        return "";
      }
      case "mobile": {
        const clean = val.replace(/\D/g, "");
        if (!clean) return "Mobile number is required.";
        if (clean.length !== 10) return "Please enter a valid 10-digit mobile number.";
        if (!/^[6-9]/.test(clean)) return "Mobile number must start with 6, 7, 8, or 9.";
        return "";
      }
      case "email": {
        const trimmed = val.trim();
        if (trimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
          return "Please enter a valid email address (e.g. name@domain.com).";
        }
        return "";
      }
      case "length":
      case "width":
      case "height": {
        const trimmed = val.trim();
        if (!trimmed) return ""; // Optional dimension
        const match = trimmed.match(/^(\d+(\.\d+)?)\s*(ft|feet|in|inch|inches|cm|m|mm|'|")?$/i);
        if (!match) {
          const label = field.charAt(0).toUpperCase() + field.slice(1);
          return `${label} must be a positive number or measurement (e.g. 6 ft, 72 in, 180 cm).`;
        }
        const num = parseFloat(match[1]);
        if (num <= 0) {
          const label = field.charAt(0).toUpperCase() + field.slice(1);
          return `${label} must be greater than 0.`;
        }
        return "";
      }
      case "pincode": {
        const trimmed = val.trim();
        if (trimmed && !/^[1-9]\d{5}$/.test(trimmed)) {
          return "PIN Code must be a valid 6-digit Indian postal code (e.g. 313001).";
        }
        return "";
      }
      default:
        return "";
    }
  };

  const countries = Object.keys(locationData);
  const availableStates =
    selectedCountry && locationData[selectedCountry]
      ? Object.keys(locationData[selectedCountry])
      : [];
  const availableCities =
    selectedCountry && selectedState && locationData[selectedCountry]?.[selectedState]
      ? locationData[selectedCountry][selectedState]
      : [];

  const effectiveCity =
    selectedCity === "Other" ? customCity.trim() : selectedCity.trim();
  const computedDeliveryLocation = [
    streetAddress.trim(),
    effectiveCity,
    selectedState.trim(),
    pincode.trim() ? `PIN: ${pincode.trim()}` : "",
    selectedCountry.trim(),
  ]
    .filter(Boolean)
    .join(", ");

  useEffect(() => {
    checkUser();
    loadOptions();
  }, []);

  async function loadOptions() {
    setOptionsLoading(true);
    try {
      const [typesRes, materialsRes] = await Promise.all([
        supabase.from("furniture_types").select("name").order("name"),
        supabase.from("material_preferences").select("name").order("name"),
      ]);

      setFurnitureTypes((typesRes.data || []).map((item) => item.name));
      setMaterialPreferences((materialsRes.data || []).map((item) => item.name));
    } catch (err) {
      console.error("Failed to load options from database:", err);
    } finally {
      setOptionsLoading(false);
    }
  }

  async function checkUser() {
    setError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.user) {
        router.replace("/login");
        return;
      }

      const user = session.user;
      setUserId(user.id);
      const userEm = user.email || "";
      setUserEmail(userEm);
      setEmail((prev) => prev || userEm);

      const metaName = (user.user_metadata as any)?.full_name;
      if (metaName) setFullName((prev) => prev || metaName);

      const metaMobile = (user.user_metadata as any)?.mobile || user.phone;
      if (metaMobile) {
        setMobile((prev) => prev || String(metaMobile).replace(/\D/g, "").slice(0, 10));
      }

      supabase
        .from("admin_users")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setIsAdmin(true);
        });

      setCheckingUser(false);
    } catch (err) {
      console.error("Auth check redirecting to login:", err);
      router.replace("/login");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccessRequestId("");

    if (!userId) {
      setError("Please login before submitting a custom furniture request.");
      return;
    }

    // Comprehensive field validation
    const errors: Record<string, string> = {};
    const nameErr = validateField("full_name", fullName);
    if (nameErr) errors.full_name = nameErr;

    const mobErr = validateField("mobile", mobile);
    if (mobErr) errors.mobile = mobErr;

    const emailErr = validateField("email", email);
    if (emailErr) errors.email = emailErr;

    const lenErr = validateField("length", length);
    if (lenErr) errors.length = lenErr;

    const widthErr = validateField("width", width);
    if (widthErr) errors.width = widthErr;

    const heightErr = validateField("height", height);
    if (heightErr) errors.height = heightErr;

    const pinErr = validateField("pincode", pincode);
    if (pinErr) errors.pincode = pinErr;

    if (!selectedCountry || !selectedState || !effectiveCity) {
      errors.delivery_location = "Please select Country, State, and City for delivery location.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTouchedFields({
        full_name: true,
        mobile: true,
        email: true,
        length: true,
        width: true,
        height: true,
        pincode: true,
        delivery_location: true,
      });
      setError("Please correct the highlighted field errors before submitting.");
      window.scrollTo({ top: 350, behavior: "smooth" });
      return;
    }

    setSubmitting(true);

    try {
      const form = event.currentTarget;
      const formData = new FormData(form);

      const requestId = generateRequestId();
      const {
        data: { user: currentUser },
        error: currentUserError,
      } = await supabase.auth.getUser();

      console.log("CURRENT USER:", currentUser?.id);
      console.log("FORM USER ID:", userId);

      if (currentUserError || !currentUser) {
        setError("Your login session has expired. Please login again.");
        setSubmitting(false);
        return;
      }

      if (currentUser.id !== userId) {
        setError("User session mismatch. Please logout and login again.");
        setSubmitting(false);
        return;
      }

      const referenceFile = formData.get("reference_image");

      let referenceImagePath: string | null = null;

      if (referenceFile instanceof File && referenceFile.size > 0) {
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowedTypes.includes(referenceFile.type)) {
          setError("Reference image must be JPG, PNG or WEBP.");
          return;
        }

        if (referenceFile.size > 10 * 1024 * 1024) {
          setError("Reference image must be smaller than 10 MB.");
          return;
        }

        const extension =
          referenceFile.name.split(".").pop()?.toLowerCase() || "jpg";

        referenceImagePath =
          `references/${userId}/${requestId}-${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("gavika-project-files")
          .upload(referenceImagePath, referenceFile, {
            contentType: referenceFile.type,
            upsert: false,
          });

        if (uploadError) {
          console.error("Reference image upload error:", uploadError);

          setError(
            `Reference image upload nahi ho paayi: ${uploadError.message || "Storage error"
            }`
          );

          return;
        }
      }

      const requestData = {
        request_id: requestId,
        user_id: userId,
        catalogue_design_id: selectedProduct?.id || null,
        catalogue_design_name: selectedProduct?.name || null,
        catalogue_design_image_url: selectedProduct?.image || null,
        full_name: fullName.trim(),
        mobile: mobile.trim(),
        email: email.trim() || userEmail,
        furniture_type: String(
          formData.get("furniture_type") || ""
        ).trim(),
        room_usage: String(formData.get("room_usage") || "").trim(),
        length: length.trim() || null,
        width: width.trim() || null,
        height: height.trim() || null,
        preferred_material: String(
          formData.get("preferred_material") || ""
        ).trim(),
        requirement: String(
          formData.get("requirement") || ""
        ).trim(),
        delivery_location: String(
          formData.get("delivery_location") || ""
        ).trim(),
        reference_image_url: referenceImagePath,
        status: "New",
      };

      const { error: insertError } = await supabase
        .from("custom_requests")
        .insert(requestData);

      if (insertError) {
        console.error("Request insert error:", insertError);

        setError(
          `Request submit nahi ho paayi: ${insertError.message || "Database error"
          }`
        );

        return;
      }

      setSuccessRequestId(requestId);

      form.reset();

      setLength("");
      setWidth("");
      setHeight("");
      setFieldErrors({});
      setTouchedFields({});
      setSelectedCountry("India");
      setSelectedState("");
      setSelectedCity("");
      setCustomCity("");
      setStreetAddress("");
      setPincode("");

      const emailInput = form.elements.namedItem("email");

      if (emailInput instanceof HTMLInputElement) {
        emailInput.value = userEmail;
      }
    } catch (err) {
      console.error("Unexpected submit error:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting your request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingUser) {
    return (
      <main className="min-h-screen bg-[#f5efe6] flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#5a3927]">
          <span className="h-6 w-6 border-3 border-[#5a3927]/30 border-t-[#5a3927] rounded-full animate-spin" />
          <span>Checking your account...</span>
        </div>
      </main>
    );
  }

  return (

    <main className="min-h-screen bg-[#f5efe6]">
      {/* NAVBAR */}
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

            <a href="/furniture" className="hover:text-[#8b6f47]">
              Furniture
            </a>

            <a href="/custom-furniture" className="text-[#8b6f47] font-semibold">
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
                    router.replace("/login");
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
                className="hover:text-[#8b6f47]"
              >
                Furniture
              </a>

              <a
                href="/custom-furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="text-[#8b6f47] font-semibold"
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
                      router.replace("/login");
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
      {selectedProduct && (
        <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          <div className="rounded-2xl border border-[#ded5c8] bg-[#f8f5ef] p-4 sm:p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 gap-2">
              <p className="text-xs sm:text-sm font-medium text-[#8b6f47]">
                Selected Furniture Design
              </p>
              {(selectedProduct.images?.length || 0) > 1 && (
                <span className="text-[11px] sm:text-xs font-semibold text-[#8b6f47] bg-[#ede5d8] px-2.5 py-0.5 rounded-full shrink-0">
                  📷 {selectedDesignImageIndex + 1} of {selectedProduct.images?.length}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4 sm:gap-5 sm:flex-row">
              <div className="flex flex-col gap-2 sm:w-56 shrink-0">
                <img
                  src={
                    selectedProduct.images?.[selectedDesignImageIndex] ||
                    selectedProduct.image
                  }
                  alt={selectedProduct.name}
                  className="h-48 sm:h-44 w-full rounded-xl object-cover shadow-xs border border-[#ded5c8]"
                />

                {(selectedProduct.images?.length || 0) > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {selectedProduct.images?.map((imgUrl, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedDesignImageIndex(idx)}
                        className={`relative h-12 w-12 sm:h-11 sm:w-11 shrink-0 overflow-hidden rounded-lg border-2 transition active:scale-95 ${
                          idx === selectedDesignImageIndex
                            ? "border-[#8b6f47] ring-1 ring-[#8b6f47]"
                            : "border-transparent opacity-60 hover:opacity-100"
                        }`}
                        title={`View photo ${idx + 1}`}
                      >
                        <img src={imgUrl} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="text-2xl font-serif font-semibold text-[#29251f]">
                  {selectedProduct.name}
                </h2>

                <p className="mt-2 text-sm text-[#8b6f47]">
                  Category: {selectedProduct.category}
                </p>

                <p className="mt-3 text-sm leading-6 text-[#625a50]">
                  {selectedProduct.description}
                </p>

                <p className="mt-3 text-sm font-medium text-[#29251f]">
                  {selectedProduct.price}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-serif font-semibold text-[#3d281c]">
            Custom Furniture
          </h1>

          <p className="mt-3 text-gray-600">
            Tell us about your requirement and our team will prepare a
            customized solution for your space.
          </p>
        </div>

        {successRequestId && (
          <div className="mb-8 rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-start gap-3">
              <span className="text-2xl">✅</span>

              <div>
                <h2 className="text-lg font-semibold text-green-800">
                  Request Submitted Successfully
                </h2>

                <p className="mt-2 text-sm text-green-700">
                  Your custom furniture request has been submitted.
                </p>

                <div className="mt-4 rounded-lg bg-white border border-green-200 px-4 py-3">
                  <p className="text-xs text-gray-500">
                    Your Request ID
                  </p>

                  <p className="text-xl font-bold text-[#3d281c] mt-1">
                    {successRequestId}
                  </p>
                </div>

                <a
                  href="/account"
                  className="inline-block mt-5 rounded-lg bg-[#5a3927] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#432a1e] transition"
                >
                  View My Account →
                </a>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <div className="flex items-start gap-3">
              <span className="text-lg">⚠️</span>

              <div>
                <p className="font-medium">Unable to submit request</p>
                <p className="mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#e7dccd] shadow-sm p-6 md:p-8 space-y-8"
        >
          <div>
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Customer Details
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              {/* Full Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>

                <input
                  name="full_name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFullName(val);
                    if (touchedFields.full_name) {
                      setFieldErrors((prev) => ({ ...prev, full_name: validateField("full_name", val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, full_name: true }));
                    setFieldErrors((prev) => ({ ...prev, full_name: validateField("full_name", fullName) }));
                  }}
                  placeholder="Enter your full name"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition ${
                    fieldErrors.full_name
                      ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.full_name && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.full_name}</span>
                  </p>
                )}
              </div>

              {/* Mobile Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>

                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-xs font-semibold text-gray-500">
                    +91
                  </div>
                  <input
                    name="mobile"
                    type="tel"
                    required
                    maxLength={10}
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                      setMobile(digits);
                      if (touchedFields.mobile) {
                        setFieldErrors((prev) => ({ ...prev, mobile: validateField("mobile", digits) }));
                      }
                    }}
                    onBlur={() => {
                      setTouchedFields((prev) => ({ ...prev, mobile: true }));
                      setFieldErrors((prev) => ({ ...prev, mobile: validateField("mobile", mobile) }));
                    }}
                    placeholder="9876543210"
                    className={`w-full rounded-lg border pl-12 pr-4 py-3 outline-none transition tracking-wide ${
                      fieldErrors.mobile
                        ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                        : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                    }`}
                  />
                </div>
                {fieldErrors.mobile ? (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.mobile}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">
                    10-digit mobile number for order updates
                  </p>
                )}
              </div>

              {/* Email */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>

                <input
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEmail(val);
                    if (touchedFields.email) {
                      setFieldErrors((prev) => ({ ...prev, email: validateField("email", val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, email: true }));
                    setFieldErrors((prev) => ({ ...prev, email: validateField("email", email) }));
                  }}
                  autoComplete="email"
                  placeholder="Enter email address (e.g. name@gmail.com)"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition ${
                    fieldErrors.email
                      ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.email && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Furniture Details
            </h2>

            <div className="grid md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Furniture Type *
                </label>

                <select
                  name="furniture_type"
                  required
                  defaultValue=""
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                >
                  <option value="" disabled>
                    {optionsLoading
                      ? "Loading furniture types..."
                      : furnitureTypes.length === 0
                        ? "No furniture types configured"
                        : "Select furniture type"}
                  </option>
                  {furnitureTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Room / Usage *
                </label>

                <input
                  name="room_usage"
                  type="text"
                  required
                  placeholder="Example: Bedroom"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Dimensions
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              Enter approximate dimensions in feet or inches (e.g. 6 ft, 72 in, 180 cm). You can discuss final
              measurements with our team.
            </p>

            <div className="grid sm:grid-cols-3 gap-5">
              {/* Length */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length
                </label>

                <input
                  name="length"
                  type="text"
                  value={length}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLength(val);
                    if (touchedFields.length) {
                      setFieldErrors((prev) => ({ ...prev, length: validateField("length", val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, length: true }));
                    setFieldErrors((prev) => ({ ...prev, length: validateField("length", length) }));
                  }}
                  placeholder="Example: 6 ft"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition ${
                    fieldErrors.length
                      ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.length && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.length}</span>
                  </p>
                )}
              </div>

              {/* Width */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width
                </label>

                <input
                  name="width"
                  type="text"
                  value={width}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWidth(val);
                    if (touchedFields.width) {
                      setFieldErrors((prev) => ({ ...prev, width: validateField("width", val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, width: true }));
                    setFieldErrors((prev) => ({ ...prev, width: validateField("width", width) }));
                  }}
                  placeholder="Example: 3 ft"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition ${
                    fieldErrors.width
                      ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.width && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.width}</span>
                  </p>
                )}
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height
                </label>

                <input
                  name="height"
                  type="text"
                  value={height}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHeight(val);
                    if (touchedFields.height) {
                      setFieldErrors((prev) => ({ ...prev, height: validateField("height", val) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, height: true }));
                    setFieldErrors((prev) => ({ ...prev, height: validateField("height", height) }));
                  }}
                  placeholder="Example: 3 ft"
                  className={`w-full rounded-lg border px-4 py-3 outline-none transition ${
                    fieldErrors.height
                      ? "border-red-400 bg-red-50/20 text-gray-900 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white text-gray-900 focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.height && (
                  <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.height}</span>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Material Preference
            </h2>

            <select
              name="preferred_material"
              defaultValue=""
              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
            >
              <option value="" disabled>
                {optionsLoading
                  ? "Loading material preferences..."
                  : materialPreferences.length === 0
                    ? "No material preferences configured"
                    : "Select preferred material"}
              </option>
              {materialPreferences.map((mat) => (
                <option key={mat} value={mat}>
                  {mat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <h2 className="text-xl font-semibold text-[#3d281c] mb-5">
              Your Requirement
            </h2>

            <textarea
              name="requirement"
              rows={6}
              required
              placeholder="Describe your furniture requirement, design preference, storage needs, colour, finish, etc."
              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none resize-y focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Reference Image
            </label>

            <input
              name="reference_image"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 bg-white text-gray-900 text-sm"
            />

            <p className="text-xs text-gray-500 mt-2">
              JPG, PNG or WEBP image. Maximum 10 MB.
            </p>
          </div>

          {/* Delivery Location Dropdowns */}
          <div className="space-y-4 rounded-xl border border-gray-200 bg-[#faf8f5] p-5">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-semibold text-gray-800">
                Delivery Location *
              </label>
              <span className="text-xs text-gray-500">
                Select Country, State & City
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {/* Country Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Country *
                </label>
                <select
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedState("");
                    setSelectedCity("");
                    setCustomCity("");
                  }}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] cursor-pointer"
                >
                  <option value="">Select Country</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* State Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  State / Province *
                </label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSelectedCity("");
                    setCustomCity("");
                  }}
                  disabled={!selectedCountry}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="">Select State</option>
                  {availableStates.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              {/* City Dropdown */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  City *
                </label>
                <select
                  value={selectedCity}
                  onChange={(e) => {
                    setSelectedCity(e.target.value);
                    if (e.target.value !== "Other") setCustomCity("");
                  }}
                  disabled={!selectedState}
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235] disabled:bg-gray-100 disabled:text-gray-400 cursor-pointer disabled:cursor-not-allowed"
                >
                  <option value="">Select City</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                  <option value="Other">Other City</option>
                </select>
              </div>
            </div>

            {selectedCity === "Other" && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Specify City Name *
                </label>
                <input
                  type="text"
                  required
                  value={customCity}
                  onChange={(e) => setCustomCity(e.target.value)}
                  placeholder="Enter your city name"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>
            )}

            {/* Street Address & Pincode */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Street Address / Flat / Landmark (Optional)
                </label>
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="e.g. 402 Lakeview Apartments, Near Chetak Circle"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  PIN Code / Postal Code
                </label>
                <input
                  type="text"
                  name="pincode"
                  value={pincode}
                  maxLength={6}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setPincode(digits);
                    if (touchedFields.pincode) {
                      setFieldErrors((prev) => ({ ...prev, pincode: validateField("pincode", digits) }));
                    }
                  }}
                  onBlur={() => {
                    setTouchedFields((prev) => ({ ...prev, pincode: true }));
                    setFieldErrors((prev) => ({ ...prev, pincode: validateField("pincode", pincode) }));
                  }}
                  placeholder="e.g. 313001"
                  className={`w-full rounded-lg border px-3.5 py-2.5 text-sm text-gray-900 outline-none transition ${
                    fieldErrors.pincode
                      ? "border-red-400 bg-red-50/20 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                      : "border-gray-300 bg-white focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                  }`}
                />
                {fieldErrors.pincode && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1 font-medium">
                    <span>⚠️</span>
                    <span>{fieldErrors.pincode}</span>
                  </p>
                )}
              </div>
            </div>

            {fieldErrors.delivery_location && (
              <p className="text-xs text-red-600 flex items-center gap-1 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                <span>⚠️</span>
                <span>{fieldErrors.delivery_location}</span>
              </p>
            )}

            {/* Hidden field for formData submission */}
            <input
              type="hidden"
              name="delivery_location"
              value={computedDeliveryLocation}
            />

            {computedDeliveryLocation && (
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-[#7a5235]">Selected Location:</span>{" "}
                {computedDeliveryLocation}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-[#5a3927] px-6 py-3.5 text-white font-semibold hover:bg-[#432a1e] transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting
                ? "Submitting Request..."
                : "Submit Custom Furniture Request"}
            </button>

            <p className="text-xs text-gray-500 text-center mt-3">
              Your request will be linked to your Gavika Furnitech account.
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}

export default function CustomFurniturePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fcfaf7] flex items-center justify-center text-gray-500">
          Loading custom furniture form...
        </div>
      }
    >
      <CustomFurnitureContent />
    </Suspense>
  );
}