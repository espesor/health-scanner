import type { BeautyProduct } from "./types";

const FIELDS = [
  "code",
  "product_name",
  "brands",
  "image_front_small_url",
  "categories_tags",
  "ingredients_text",
  "ingredients",
].join(",");

/** Look up a personal-care product by barcode on Open Beauty Facts. */
export async function fetchBeautyProduct(barcode: string): Promise<BeautyProduct | null> {
  const res = await fetch(
    `https://world.openbeautyfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Beauty Facts returned HTTP ${res.status}`);
  const json = await res.json();
  const p = json?.product;
  if (!p || json.status === 0) return null;

  const parsed: string[] = Array.isArray(p.ingredients)
    ? p.ingredients
        .map((i: { text?: string }) => (i.text ?? "").trim().toLowerCase())
        .filter((t: string) => t.length > 1)
    : [];

  return {
    barcode: String(json.code ?? barcode),
    name: p.product_name || "Unknown product",
    brand: p.brands || undefined,
    imageUrl: p.image_front_small_url || undefined,
    categoriesTags: Array.isArray(p.categories_tags) ? p.categories_tags : [],
    ingredientsText: p.ingredients_text || undefined,
    ingredients: parsed,
  };
}
