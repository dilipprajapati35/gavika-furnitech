"use client";
export const dynamic = "force-dynamic";
import { useSearchParams } from "next/navigation";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { products } from "@/data/products";

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
  };

  const [selectedProduct, setSelectedProduct] = useState<SelectedDesignType | null>(null);

  useEffect(() => {
    if (!selectedDesign) return;

    // Check static list first
    const staticFound = products.find((p) => p.id === selectedDesign);
    if (staticFound) {
      setSelectedProduct(staticFound);
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
          setSelectedProduct({
            id: data.id,
            name: data.name,
            category: data.category,
            description: data.description || "",
            price: data.price || "Custom Quote",
            image: data.image_url,
          });
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
      setUserEmail(user.email || "");

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
            `Reference image upload nahi ho paayi: ${
              uploadError.message || "Storage error"
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
        full_name: String(formData.get("full_name") || "").trim(),
        mobile: String(formData.get("mobile") || "").trim(),
        email: String(formData.get("email") || "").trim() || userEmail,
        furniture_type: String(
          formData.get("furniture_type") || ""
        ).trim(),
        room_usage: String(formData.get("room_usage") || "").trim(),
        length: String(formData.get("length") || "").trim(),
        width: String(formData.get("width") || "").trim(),
        height: String(formData.get("height") || "").trim(),
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
          `Request submit nahi ho paayi: ${
            insertError.message || "Database error"
          }`
        );

        return;
      }

      setSuccessRequestId(requestId);

      form.reset();

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
              src="/gavika-logo.png"
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
        <div className="max-w-4xl mx-auto px-6 pt-8">
          <div className="rounded-2xl border border-[#ded5c8] bg-[#f8f5ef] p-5 shadow-sm">
            <p className="mb-3 text-sm font-medium text-[#8b6f47]">
              Selected Furniture Design
            </p>

            <div className="flex flex-col gap-5 sm:flex-row">
              <img
                src={selectedProduct.image}
                alt={selectedProduct.name}
                className="h-40 w-full rounded-xl object-cover sm:w-52"
              />

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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>

                <input
                  name="full_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Enter your full name"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>

                <input
                  name="mobile"
                  type="tel"
                  required
                  autoComplete="tel"
                  placeholder="Enter mobile number"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>

                <input
                  name="email"
                  type="email"
                  defaultValue={userEmail}
                  autoComplete="email"
                  placeholder="Enter email address"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
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
              Enter approximate dimensions in feet. You can discuss final
              measurements with our team.
            </p>

            <div className="grid sm:grid-cols-3 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Length
                </label>

                <input
                  name="length"
                  type="text"
                  placeholder="Example: 6 ft"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Width
                </label>

                <input
                  name="width"
                  type="text"
                  placeholder="Example: 3 ft"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height
                </label>

                <input
                  name="height"
                  type="text"
                  placeholder="Example: 3 ft"
                  className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
                />
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Location *
            </label>

            <textarea
              name="delivery_location"
              rows={3}
              required
              placeholder="Enter your delivery location"
              className="w-full rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 px-4 py-3 outline-none resize-y focus:border-[#7a5235] focus:ring-1 focus:ring-[#7a5235]"
            />
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