import type { MealContext, Product } from "./types";

const FIELDS = [
  "code",
  "product_name",
  "brands",
  "image_front_small_url",
  "categories_tags",
  "nova_group",
  "additives_tags",
  "ingredients_text",
  "nutriments",
  "serving_quantity",
  "serving_size",
].join(",");

function num(v: unknown): number | undefined {
  const x = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

/** Look up a product by barcode. Returns null if Open Food Facts doesn't know it. */
export async function fetchProduct(barcode: string): Promise<Product | null> {
  const res = await fetch(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Open Food Facts returned HTTP ${res.status}`);
  const json = await res.json();
  const p = json?.product;
  if (!p || json.status === 0) return null;

  const n = p.nutriments ?? {};
  let salt = num(n["salt_100g"]);
  const sodium = num(n["sodium_100g"]);
  if (salt === undefined && sodium !== undefined) salt = sodium * 2.5;

  const energyKcal = num(n["energy-kcal_100g"]);
  // OFF's plain energy_100g is in kJ
  let energyKj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
  if (energyKj === undefined && energyKcal !== undefined) energyKj = energyKcal * 4.184;

  return {
    barcode: String(json.code ?? barcode),
    name: p.product_name || "Unknown product",
    brand: p.brands || undefined,
    imageUrl: p.image_front_small_url || undefined,
    categoriesTags: Array.isArray(p.categories_tags) ? p.categories_tags : [],
    novaGroup: num(p.nova_group),
    additivesTags: Array.isArray(p.additives_tags) ? p.additives_tags : [],
    ingredientsText: p.ingredients_text || undefined,
    nutriments: {
      energyKj,
      energyKcal,
      sugars: num(n["sugars_100g"]),
      saturatedFat: num(n["saturated-fat_100g"]),
      salt,
      fiber: num(n["fiber_100g"]),
      proteins: num(n["proteins_100g"]),
      fruitsVegNutsPct:
        num(n["fruits-vegetables-nuts-estimate-from-ingredients_100g"]) ??
        num(n["fruits-vegetables-nuts_100g"]),
      transFat: num(n["trans-fat_100g"]),
    },
    servingSizeG: num(p.serving_quantity),
    servingSizeText: p.serving_size || undefined,
  };
}

const SNACK_TAGS = [
  "en:snacks",
  "en:sweet-snacks",
  "en:salty-snacks",
  "en:confectioneries",
  "en:biscuits",
  "en:cookies",
  "en:cakes",
  "en:pastries",
  "en:chocolates",
  "en:candies",
  "en:crisps",
  "en:chips",
  "en:ice-creams",
  "en:desserts",
  "en:snack-bars",
  "en:sweet-spreads",
  "en:beverages",
];

const MEAL_TAGS = [
  "en:meals",
  "en:ready-meals",
  "en:soups",
  "en:pastas",
  "en:pizzas",
  "en:breakfast-cereals",
  "en:breads",
  "en:cereals-and-potatoes",
];

/**
 * Guess snack vs meal from the product's category tags. Snack tags win when
 * both match (e.g. "biscuits" under "cereals"). Unknown -> meal (staples and
 * ingredients are judged as meal components); the user can flip it in the UI.
 */
export function inferContext(product: Product): MealContext {
  const tags = product.categoriesTags;
  if (tags.some((t) => SNACK_TAGS.includes(t))) return "snack";
  if (tags.some((t) => MEAL_TAGS.includes(t))) return "meal";
  return "meal";
}
