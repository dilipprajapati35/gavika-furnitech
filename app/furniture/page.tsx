"use client";

import { supabase } from "@/utils/supabase/client";
import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: string;
  image: string;
};

export default function FurniturePage() {
  const [productsList, setProductsList] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user || null);
      if (session?.user) {
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

  useEffect(() => {
    async function loadProducts() {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .order("created_at", { ascending: false });

        if (!error && data && data.length > 0) {
          setProductsList(
            data.map((p) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              description: p.description || "",
              price: p.price || "Custom Quote",
              image: p.image_url,
            }))
          );
        }
      } catch (err) {
        console.error("Failed to load products from database:", err);
      } finally {
        setLoading(false);
      }
    }

    loadProducts();
  }, []);

  const categories = [
    "All",
    ...Array.from(new Set(productsList.map((p) => p.category))),
  ];

  const filteredProducts =
    selectedCategory === "All"
      ? productsList
      : productsList.filter((product) => product.category === selectedCategory);

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#29251f]">
      {/* Header */}
      <header className="border-b border-[#ded6c8] bg-[#f8f5ef]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <a href="/" className="flex items-center gap-3">
            <img
              src="/gavika-logo.png"
              alt="Gavika Furnitech"
              className="h-14 w-auto object-contain"
            />

            <div>
              <p className="text-xl font-semibold tracking-wide">
                Gavika Furnitech
              </p>
              <p className="text-xs tracking-[0.2em] text-[#8b6f47]">
                PREMIUM FURNITURE
              </p>
            </div>
          </a>

          <nav className="hidden gap-8 text-sm font-medium md:flex">
            <a href="/" className="hover:text-[#8b6f47]">
              Home
            </a>
            <a href="/furniture" className="text-[#8b6f47]">
              Furniture
            </a>
            <a href="/custom-furniture" className="hover:text-[#8b6f47]">
              Custom Furniture
            </a>
            <a href="/about" className="hover:text-[#8b6f47]">
              About
            </a>
            <a href="/contact" className="hover:text-[#8b6f47]">
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
        </div>
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
      <section className="mx-auto max-w-7xl px-6">
        <div className="flex flex-wrap gap-3 border-b border-[#ded6c8] pb-8">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${selectedCategory === category
                  ? "bg-[#29251f] text-white"
                  : "border border-[#d7cdbd] bg-white text-[#5f574d] hover:border-[#8b6f47]"
                }`}
            >
              {category}
            </button>
          ))}
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
              <article
                key={product.id || product.name}
                className="group overflow-hidden rounded-2xl border border-[#e2dbcf] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
              >
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-[#eee8de]">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                  />

                  <div className="absolute left-4 top-4 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-[#6f5635]">
                    {product.category}
                  </div>
                </div>

                {/* Details */}
                <div className="p-6">
                  <h3 className="text-xl font-semibold">{product.name}</h3>

                  <p className="mt-3 min-h-[52px] text-sm leading-6 text-[#746c62]">
                    {product.description}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-[#9a7748]">
                        Pricing
                      </p>

                      <p className="mt-1 font-semibold">{product.price}</p>
                    </div>

                    <a
                      href={`/custom-furniture?design=${encodeURIComponent(product.id)}`}
                      className="rounded-full bg-[#29251f] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#8b6f47]"
                    >
                      Enquire
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
              src="/gavika-logo.png"
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