/** All nutrient values are per 100 g. */
export interface Nutriments {
  energyKj?: number;
  energyKcal?: number;
  sugars?: number;
  saturatedFat?: number;
  /** grams of salt (sodium x 2.5) */
  salt?: number;
  fiber?: number;
  proteins?: number;
  /** % fruit/vegetables/legumes/nuts, estimated from ingredients */
  fruitsVegNutsPct?: number;
  transFat?: number;
}

export interface Product {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  categoriesTags: string[];
  /** NOVA processing group 1-4 */
  novaGroup?: number;
  /** e.g. ["en:e330", "en:e171"] */
  additivesTags: string[];
  ingredientsText?: string;
  nutriments: Nutriments;
  servingSizeG?: number;
  servingSizeText?: string;
}

export type MealContext = "snack" | "meal";

export type Band = "excellent" | "good" | "okay" | "poor" | "avoid";

/** One named reason contributing to the score. impact is on the 10-point scale. */
export interface ScoreFactor {
  id: string;
  label: string;
  detail: string;
  impact: number;
  source: string;
}

export interface BreakdownRow {
  label: string;
  value: string;
  points: string;
  source: string;
}

// ---- Personal care (DESIGN.md 5.2) ----

export interface BeautyProduct {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  categoriesTags: string[];
  ingredientsText?: string;
  /** parsed ingredient tokens (from OBF's parse when present, else split from text) */
  ingredients: string[];
}

/** How the product is used — determines which ingredient flags apply. */
export type CareKind = "sunscreen" | "oral" | "rinse-off" | "leave-on";

export type HazardTier = "A" | "B" | "C";

export interface FlaggedIngredient {
  /** the ingredient token as printed on the label */
  ingredient: string;
  entryId: string;
  label: string;
  tier: HazardTier;
  reason: string;
  source: string;
  impact: number;
}

export interface CarePositive {
  label: string;
  detail: string;
  source: string;
}

export interface CareScoreResult {
  score: number;
  band: Band;
  kind: CareKind;
  kindLabel: string;
  flagged: FlaggedIngredient[];
  positives: CarePositive[];
  /** context notes always shown (e.g. the sunscreen disclaimer) */
  notes: string[];
  unknown: string[];
  totalIngredients: number;
  confidence: "full" | "partial";
  rubricVersion: string;
}

export interface ScoreResult {
  /** 1-10 in 0.5 steps, 10 = healthiest */
  score: number;
  band: Band;
  context: MealContext;
  /** base 1-10 from the nutrient profile, before modifiers */
  base: number;
  /** raw Nutri-Score-style points (higher = worse) */
  raw: number;
  /** headline reasons, worst first — the "Why this score" bullets */
  drivers: ScoreFactor[];
  /** post-base adjustments (NOVA, additives, serving caps) */
  modifiers: ScoreFactor[];
  /** full metric table */
  breakdown: BreakdownRow[];
  confidence: "full" | "partial";
  missing: string[];
  rubricVersion: string;
}
