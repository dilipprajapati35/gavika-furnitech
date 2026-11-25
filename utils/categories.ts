/**
 * Priority order for sorting categories so customer-facing catalogues
 * display primary furniture types first (Beds, Dining, Sofas, Wardrobes, etc.).
 */
export function getCategoryOrderIndex(catName: string): number {
  const norm = (catName || "").trim().toLowerCase();
  if (norm.includes("bed") || norm.includes("bedroom")) return 1;
  if (norm.includes("dining")) return 2;
  if (norm.includes("sofa") || norm.includes("couch") || norm.includes("living")) return 3;
  if (norm.includes("wardrobe") || norm.includes("almirah") || norm.includes("closet")) return 4;
  if (norm.includes("tv") || norm.includes("entertainment") || norm.includes("unit")) return 5;
  if (norm.includes("kitchen")) return 6;
  if (norm.includes("study")) return 7;
  if (norm.includes("office") || norm.includes("desk") || norm.includes("chair")) return 8;
  if (norm.includes("table")) return 9;
  return 99;
}

export type CategoryNav = {
  name: string;
  icon: string;
  description: string;
  href: string;
};

/**
 * Maps any furniture category or type name to an intuitive ecommerce icon.
 */
export function getCategoryIcon(name: string): string {
  const norm = (name || "").trim().toLowerCase();
  if (norm.includes("bed") || norm.includes("bedroom")) return "🛏️";
  if (norm.includes("dining")) return "🍽️";
  if (norm.includes("sofa") || norm.includes("couch") || norm.includes("living")) return "🛋️";
  if (norm.includes("office") || norm.includes("desk") || norm.includes("chair")) return "💼";
  if (norm.includes("study")) return "📚";
  if (norm.includes("wardrobe") || norm.includes("almirah") || norm.includes("closet")) return "🚪";
  if (norm.includes("tv") || norm.includes("entertainment") || norm.includes("unit")) return "📺";
  if (norm.includes("kitchen")) return "🍳";
  if (norm.includes("custom")) return "✨";
  if (norm === "all" || norm.includes("all")) return "🏷️";
  return "🪵";
}

/**
 * Primary ecommerce categories displayed in the top navigation strip (Amazon / IKEA style).
 */
export const STORE_CATEGORIES: CategoryNav[] = [
  {
    name: "Living Room",
    icon: "🛋️",
    description: "Sofas, TV units & coffee tables",
    href: "/furniture?category=Living%20Room",
  },
  {
    name: "Bedroom",
    icon: "🛏️",
    description: "Beds, wardrobes & side tables",
    href: "/furniture?category=Bedroom",
  },
  {
    name: "Dining",
    icon: "🍽️",
    description: "Dining tables & dining sets",
    href: "/furniture?category=Dining",
  },
  {
    name: "Wardrobes",
    icon: "🚪",
    description: "Solid-wood wardrobes & storage",
    href: "/furniture?category=Wardrobe",
  },
  {
    name: "Office",
    icon: "💼",
    description: "Desks, chairs & executive tables",
    href: "/furniture?category=Office",
  },
  {
    name: "Custom Furniture",
    icon: "✨",
    description: "Handcrafted to your exact specifications",
    href: "/custom-furniture",
  },
  {
    name: "All Designs",
    icon: "🏷️",
    description: "Explore the full furniture catalogue",
    href: "/furniture",
  },
];
