"use client";

import { supabase } from "@/utils/supabase/client";
import { useEffect, useState } from "react";
const categories = [
  {
    name: "Living Room",
    description: "Sofas, coffee tables & TV units",
    icon: "🛋️",
  },
  {
    name: "Bedroom",
    description: "Beds, wardrobes & side tables",
    icon: "🛏️",
  },
  {
    name: "Dining",
    description: "Dining tables & complete sets",
    icon: "🍽️",
  },
  {
    name: "Office",
    description: "Desks, chairs & storage",
    icon: "💼",
  },
];

type DbProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: string;
  image_url: string;
};

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [featuredProducts, setFeaturedProducts] = useState<DbProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    // Load real products from database for Featured Designs
    supabase
      .from("products")
      .select("id, name, category, description, price, image_url")
      .order("created_at", { ascending: false })
      .limit(6)
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) {
          setFeaturedProducts(data);
        }
        setProductsLoading(false);
      });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && session?.access_token) {
        setSessionUser(session.user);
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
      if (!session?.user) {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#29251f]">

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
            <a href="/" className="text-[#8b6f47]">
              Home
            </a>

            <a href="/furniture" className="hover:text-[#8b6f47]">
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

            {sessionUser ? (
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
                    setSessionUser(null);
                    setIsAdmin(false);
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

              {sessionUser ? (
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
                      setSessionUser(null);
                      setIsAdmin(false);
                      setMobileMenuOpen(false);
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

      {/* HERO */}
      <section id="home" className="overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">

          <div>
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-[#8b5e3c]">
              Custom Furniture • Udaipur
            </p>

            <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
              Furniture Made
              <span className="block text-[#8b5e3c]">
                For Your Space.
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-8 text-[#625b52]">
              Custom-designed. Professionally crafted. Quality checked.
              Delivered to your doorstep.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <a
                href="/furniture"
                className="rounded-full bg-[#29251f] px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-[#8b5e3c]"
              >
                Explore Furniture
              </a>

              <a
                href="#custom"
                className="rounded-full border border-[#29251f] px-7 py-3.5 text-sm font-semibold transition hover:bg-[#29251f] hover:text-white"
              >
                Create Custom Furniture
              </a>
            </div>

            <div className="mt-12 flex gap-8 border-t border-[#ded5c8] pt-7">
              <div>
                <p className="text-2xl font-semibold">Custom</p>
                <p className="mt-1 text-sm text-[#746c62]">
                  Made for you
                </p>
              </div>

              <div>
                <p className="text-2xl font-semibold">Quality</p>
                <p className="mt-1 text-sm text-[#746c62]">
                  Checked before delivery
                </p>
              </div>

              <div>
                <p className="text-2xl font-semibold">Udaipur</p>
                <p className="mt-1 text-sm text-[#746c62]">
                  Rajasthan
                </p>
              </div>
            </div>
          </div>

          {/* HERO LOGO / BRAND */}
          <div className="flex justify-center">
            <div className="flex aspect-square w-full max-w-lg items-center justify-center rounded-[2rem] bg-white p-10 shadow-xl">
              <img
                src="/gavika-logo.png"
                alt="Gavika Furnitech Logo"
                className="max-h-full max-w-full object-contain"
              />
            </div>
          </div>

        </div>
      </section>

      {/* CATEGORIES */}
      <section
        id="furniture"
        className="border-y border-[#ded5c8] bg-[#efe8dc]"
      >
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b5e3c]">
                Explore
              </p>

              <h2 className="mt-3 text-4xl font-semibold tracking-tight">
                Furniture for every room
              </h2>
            </div>

            <p className="max-w-md text-[#625b52]">
              Choose from our designs or tell us exactly what you have in
              mind. We can build it around your space.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {categories.map((category) => (
              <div
                key={category.name}
                className="group rounded-3xl border border-[#d3c8b9] bg-[#f8f5ef] p-7 transition duration-300 hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e5d8c7] text-2xl">
                  {category.icon}
                </div>

                <h3 className="mt-7 text-xl font-semibold">
                  {category.name}
                </h3>

                <p className="mt-2 text-sm leading-6 text-[#746c62]">
                  {category.description}
                </p>

                <button className="mt-6 text-sm font-semibold text-[#8b5e3c]">
                  Explore →
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED DESIGNS */}
      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b5e3c]">
            Featured Designs
          </p>

          <h2 className="mt-3 text-4xl font-semibold tracking-tight">
            Made to look beautiful. Built to last.
          </h2>
        </div>

        {productsLoading ? (
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="rounded-3xl bg-[#eee8de] animate-pulse h-80" />
            ))}
          </div>
        ) : featuredProducts.length === 0 ? (
          <div className="mt-12 text-center py-12 bg-white rounded-3xl border border-[#e7dccd]">
            <p className="text-gray-500 text-sm">No catalogue designs published yet.</p>
          </div>
        ) : (
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="group flex flex-col justify-between overflow-hidden rounded-3xl bg-white border border-[#e7dccd] shadow-xs hover:shadow-md transition duration-300"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#eee8de]">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#8c6b4d] text-white text-3xl">
                      🛋️
                    </div>
                  )}
                  <div className="absolute left-4 top-4 rounded-full bg-white/95 backdrop-blur-xs px-3.5 py-1 text-xs font-semibold text-[#6f5635] shadow-xs">
                    {product.category}
                  </div>
                </div>

                <div className="p-6 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="text-xl font-semibold text-[#29251f] group-hover:text-[#8b5e3c] transition">
                      {product.name}
                    </h3>
                    {product.description && (
                      <p className="mt-2 text-sm text-[#746c62] line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-[#9a7748] font-semibold">
                        Pricing
                      </p>
                      <p className="text-sm font-semibold text-[#29251f]">
                        {product.price || "Custom Quote"}
                      </p>
                    </div>

                    <a
                      href={`/custom-furniture?design=${encodeURIComponent(product.id)}`}
                      className="rounded-full bg-[#29251f] px-5 py-2 text-xs font-semibold text-white transition hover:bg-[#8b5e3c] shadow-xs"
                    >
                      Enquire Design →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <a
            href="/furniture"
            className="inline-flex items-center gap-2 rounded-full border border-[#cfc4b5] bg-white px-8 py-3.5 text-sm font-semibold text-[#29251f] transition hover:bg-[#29251f] hover:text-white shadow-xs"
          >
            <span>Explore All Furniture Designs</span>
            <span>→</span>
          </a>
        </div>
      </section>

      {/* CUSTOM FURNITURE */}
      <section id="custom" className="bg-[#29251f] text-white">
        <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">

          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d5ad84]">
                Custom Furniture
              </p>

              <h2 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
                Have an idea?
                <span className="block text-[#d5ad84]">
                  Let&apos;s build it.
                </span>
              </h2>

              <p className="mt-6 max-w-xl text-lg leading-8 text-[#d2c9be]">
                Share your requirements, dimensions, reference images or
                sketches. Our team will review your request and prepare a
                quotation and design for you.
              </p>

              <a
                href="#contact"
                className="mt-9 inline-flex rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-[#29251f] transition hover:bg-[#d5ad84]"
              >
                Submit Custom Request →
              </a>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-8">

              <p className="text-sm font-semibold uppercase tracking-wider text-[#d5ad84]">
                Your Custom Project
              </p>

              <div className="mt-8 space-y-5">

                {[
                  ["01", "Tell us your requirement"],
                  ["02", "Get quotation & design"],
                  ["03", "Approve your project"],
                  ["04", "Pay 30% advance"],
                  ["05", "Production begins"],
                ].map(([number, text]) => (
                  <div
                    key={number}
                    className="flex items-center gap-5 border-b border-white/10 pb-5"
                  >
                    <span className="text-sm text-[#d5ad84]">
                      {number}
                    </span>

                    <span className="font-medium">
                      {text}
                    </span>
                  </div>
                ))}

              </div>
            </div>

          </div>
        </div>
      </section>

      {/* PROCESS */}
      <section id="process" className="bg-[#efe8dc]">
        <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#8b5e3c]">
              Our Process
            </p>

            <h2 className="mt-3 text-4xl font-semibold">
              From idea to your doorstep
            </h2>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-5">

            {[
              "Requirement",
              "Design & Drawing",
              "Manufacturing",
              "Quality Check",
              "Delivery",
            ].map((step, index) => (
              <div
                key={step}
                className="rounded-3xl bg-[#f8f5ef] p-6 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#29251f] text-sm font-semibold text-white">
                  {index + 1}
                </div>

                <h3 className="mt-5 font-semibold">
                  {step}
                </h3>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-7xl px-6 py-20 lg:px-8">

        <div className="rounded-[2rem] bg-[#d9c4aa] p-8 sm:p-12 lg:p-16">

          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#765034]">
                Start Your Project
              </p>

              <h2 className="mt-4 text-4xl font-semibold tracking-tight">
                Let&apos;s create furniture made for you.
              </h2>

              <p className="mt-5 max-w-xl leading-7 text-[#5e5144]">
                Tell us what you need and our team will get back to you
                with the next steps.
              </p>
            </div>

            <div className="rounded-3xl bg-[#f8f5ef] p-7">

              <div className="space-y-5 text-sm">

                <div>
                  <p className="text-xs uppercase tracking-wider text-[#8b5e3c]">
                    Owners
                  </p>

                  <p className="mt-1 font-semibold">
                    Tejas Chouhan &amp; Ankit Lohar
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-[#8b5e3c]">
                    Location
                  </p>

                  <p className="mt-1 font-semibold">
                    Udaipur, Rajasthan
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-[#8b5e3c]">
                    WhatsApp / Phone
                  </p>

                  <a
                    href="tel:8619906867"
                    className="mt-1 block font-semibold hover:text-[#8b5e3c]"
                  >
                    8619906867
                  </a>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-wider text-[#8b5e3c]">
                    Email
                  </p>

                  <a
                    href="mailto:gavikafurnitech@gmail.com"
                    className="mt-1 block font-semibold hover:text-[#8b5e3c]"
                  >
                    gavikafurnitech@gmail.com
                  </a>
                </div>

              </div>

              <a
                href="https://wa.me/918619906867"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-7 block w-full rounded-full bg-[#29251f] px-6 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-[#8b5e3c]"
              >
                WhatsApp Us
              </a>

            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#3c3730] bg-[#29251f] text-[#d8d0c5]">

        <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">

          <div className="grid gap-8 md:grid-cols-3">

            <div>
              <img
                src="/gavika-logo.png"
                alt="Gavika Furnitech"
                className="h-20 w-auto rounded-lg object-contain"
              />
            </div>

            <div>
              <p className="font-semibold text-white">
                Gavika Furnitech
              </p>

              <p className="mt-2 text-sm leading-6">
                Custom furniture designed and crafted around your space.
              </p>
            </div>

            <div>
              <p className="font-semibold text-white">
                Contact
              </p>

              <p className="mt-2 text-sm">
                8619906867
              </p>

              <p className="mt-1 text-sm">
                gavikafurnitech@gmail.com
              </p>
            </div>

          </div>

          <div className="mt-8 border-t border-white/10 pt-6 text-sm">
            © 2026 Gavika Furnitech. All rights reserved.
          </div>

        </div>
      </footer>

    </main>
  );
}