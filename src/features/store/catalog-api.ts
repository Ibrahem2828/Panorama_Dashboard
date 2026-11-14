"use client";

import { useQuery } from "@tanstack/react-query";

import { storePath, type ProductImage, type SpecRow } from "@/features/store/store-rules";
import { apiFetch, normalizeCollection } from "@/lib/api/browser-client";

export interface StoreBrand { id: number; name: string; logo_url: string | null; sort_order: number; is_active: boolean; products_count: number; created_at: string }
export interface StoreCategory { id: number; name: string; slug: string; sort_order: number; is_active: boolean }
export interface StoreProduct {
  id: number;
  name: string;
  description: string;
  brand: number | null;
  category: number;
  specs: SpecRow[];
  price_syp: string | null;
  price_usd: string | null;
  is_active: boolean;
  sort_order: number;
  rating_avg: string;
  rating_count: number;
  sold_count: number;
  variants_count: number;
  created_at: string;
}
export interface StoreVariant {
  id: number;
  product: number;
  sku: string;
  colour_name: string;
  colour_hex: string;
  size_label: string;
  price_syp: string | null;
  price_usd: string | null;
  max_per_order: number | null;
  is_active: boolean;
  sort_order: number;
  inventory_item: number | null;
  stock: number;
  reorder_level: number;
}

export const KEYS = {
  brands: "store-brands",
  categories: "store-categories",
  products: "store-products",
  variants: "store-variants",
  images: "store-images",
} as const;

/** Every brand (the pickers and filters need them all; a shop has a handful), alphabetical. */
export function useAllBrands() {
  return useQuery({
    queryKey: [KEYS.brands, "all"],
    queryFn: async () => normalizeCollection<StoreBrand>(await apiFetch(`${storePath("brands")}?page_size=100&ordering=name`)),
  });
}

export function useAllCategories() {
  return useQuery({
    queryKey: [KEYS.categories, "all"],
    queryFn: async () => normalizeCollection<StoreCategory>(await apiFetch(`${storePath("categories")}?ordering=sort_order`)),
  });
}

export function useProductVariants(productId: number | null) {
  return useQuery({
    queryKey: [KEYS.variants, productId],
    enabled: productId !== null,
    queryFn: async () => normalizeCollection<StoreVariant>(await apiFetch(`${storePath("variants")}?product=${productId}&page_size=100`)),
  });
}

export function useProductImages(productId: number | null) {
  return useQuery({
    queryKey: [KEYS.images, productId],
    enabled: productId !== null,
    queryFn: async () => normalizeCollection<ProductImage>(await apiFetch(`${storePath("images")}?product=${productId}`)),
  });
}

/** The primary picture of every product, for the thumbnails of the product table. */
export function usePrimaryImages() {
  return useQuery({
    queryKey: [KEYS.images, "primary"],
    queryFn: async () => {
      const page = await normalizeCollection<ProductImage>(await apiFetch(`${storePath("images")}?is_primary=true`));
      return new Map(page.results.map((image) => [image.product, image.thumb_url] as const));
    },
  });
}
