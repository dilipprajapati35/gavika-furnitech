"use client";

import { useState } from "react";
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

const featuredProducts = [
  {
    name: "Modern Wooden Sofa",
    category: "Living Room",
    price: "Custom Quote",
  },
  {
    name: "Premium King Bed",
    category: "Bedroom",
    price: "Custom Quote",
  },
  {
    name: "Six Seater Dining Table",
    category: "Dining",
    price: "Custom Quote",
  },
];

export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <main className="min-h-screen bg-[#f8f5ef] text-[#29251f]">

      {/* NAVBAR */}
      <header className="sticky top-0 z-50 border-b border-[#ded5c8] bg-[#f8f5ef]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3 lg:px-8">

          <a href="#home" className="flex items-center gap-3">
            <img
              src="/logo.jpg"
              alt="Gavika Furnitech"
              className="h-14 w-auto object-contain"
            />

            <div className="hidden sm:block">
              <p className="text-lg font-semibold tracking-wide">
                Gavika
              </p>
              <p className="text-[10px] font-medium tracking-[0.28em] text-[#8b5e3c]">
                FURNITECH
              </p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 text-sm md:flex">
            <a href="#home" className="hover:text-[#8b5e3c]">
              Home
            </a>

            <a href="/furniture" className="hover:text-[#8b5e3c]">
              Furniture
            </a>
            
            <a href="/login" className="hover:text-[#8b5e3c]">
               Login / My Account
            </a>

            <a href="/custom-furniture" className="hover:text-[#8b5e3c]">
              Custom Furniture
            </a>

            <a href="#process" className="hover:text-[#8b5e3c]">
              How It Works
            </a>

            <a href="#contact" className="hover:text-[#8b5e3c]">
              Contact
            </a>
          </nav>

          <div className="flex items-center gap-3">

            <a
              href="/custom-furniture"
              className="hidden sm:inline-flex rounded-full bg-[#29251f] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#8b5e3c]"
            >
              Start a Project
            </a>

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden rounded-lg border border-[#ded5c8] px-3 py-2 text-xl"
              aria-label="Open menu"
            >
              {mobileMenuOpen ? "✕" : "☰"}
            </button>

          </div>
        </div>
                {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#ded5c8] bg-[#f8f5ef] px-5 py-4">
            <nav className="flex flex-col gap-4 text-sm">

              <a
                href="#home"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                Home
              </a>

              <a
                href="/furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                Furniture
              </a>

              <a
                href="/custom-furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                Custom Furniture
              </a>

              <a
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                Login / My Account
              </a>

              <a
                href="#process"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                How It Works
              </a>

              <a
                href="#contact"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-[#8b5e3c]"
              >
                Contact
              </a>

              <a
                href="/custom-furniture"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 rounded-full bg-[#29251f] px-5 py-3 text-center text-sm font-semibold text-white"
              >
                Start a Project
              </a>

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
                src="/logo.jpg"
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

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {featuredProducts.map((product, index) => (
            <div key={product.name} className="group">

              <div
                className={`aspect-[4/3] rounded-3xl ${
                  index === 0
                    ? "bg-[#8c6b4d]"
                    : index === 1
                      ? "bg-[#b49a7b]"
                      : "bg-[#675542]"
                }`}
              >
                <div className="flex h-full items-end rounded-3xl bg-black/10 p-6">
                  <span className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold">
                    {product.category}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 pt-5">
                <div>
                  <h3 className="text-xl font-semibold">
                    {product.name}
                  </h3>

                  <p className="mt-1 text-sm text-[#746c62]">
                    {product.price}
                  </p>
                </div>

                <button className="rounded-full border border-[#cfc4b5] px-4 py-2 text-sm font-medium transition hover:bg-[#29251f] hover:text-white">
                  View
                </button>
              </div>
            </div>
          ))}
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
                src="/logo.jpg"
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