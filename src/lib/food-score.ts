import type {
  Band,
  BreakdownRow,
  MealContext,
  Product,
  ScoreFactor,
  ScoreResult,
} from "./types";

export const RUBRIC_VERSION = "1.0";

const SRC = {
  ns: "Nutri-Score 2023 nutrient-profile algorithm",
  dga: "Dietary Guidelines for Americans 2020–2025",
  who: "WHO healthy-diet guidelines",
  nova: "NOVA classification",
  efsa: "EFSA / EU additive evaluations",
  rubric: "Health Scanner rubric §5 (DESIGN.md)",
};

/** Nutri-Score 2023 point thresholds (general foods, per 100 g). */
const T = {
  energyKj: [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350],
  sugars: [3.4, 6.8, 10, 14, 17, 20, 24, 27, 31, 34, 37, 41, 44, 48, 51],
  satFat: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  salt: Array.from({ length: 20 }, (_, i) => Math.round((i + 1) * 0.2 * 10) / 10),
  protein: [2.4, 4.8, 7.2, 9.6, 12, 14, 17],
  fiber: [3.0, 4.1, 5.2, 6.3, 7.4],
};

function pts(value: number, thresholds: number[]): number {
  let p = 0;
  for (const t of thresholds) if (value > t) p++;
  return p;
}

/**
 * Raw points -> base score. Piecewise-linear, calibrated so Nutri-Score
 * A ~ 8-10, B ~ 7, C ~ 5-6, D ~ 3-4, E ~ 1-2 (DESIGN.md 5.1 step 4).
 */
const RAW_TO_BASE: [number, number][] = [
  [-15, 10],
  [-5, 10],
  [0, 8],
  [2, 7],
  [10, 5],
  [18, 3],
  [30, 1],
];

function rawToBase(raw: number): number {
  const map = RAW_TO_BASE;
  if (raw <= map[0][0]) return map[0][1];
  if (raw >= map[map.length - 1][0]) return map[map.length - 1][1];
  for (let i = 1; i < map.length; i++) {
    const [x1, y1] = map[i - 1];
    const [x2, y2] = map[i];
    if (raw <= x2) return y1 + ((raw - x1) / (x2 - x1)) * (y2 - y1);
  }
  return map[map.length - 1][1];
}

/** Additives penalized -0.5 each (capped at -1.5). Values are the user-facing reason. */
export const ADDITIVES_OF_CONCERN: Record<string, string> = {
  "en:e171": "titanium dioxide — EFSA (2021): no longer considered safe as a food additive",
  "en:e102": "tartrazine — azo dye; carries an EU hyperactivity warning label",
  "en:e104": "quinoline yellow — carries an EU hyperactivity warning label",
  "en:e110": "sunset yellow FCF — carries an EU hyperactivity warning label",
  "en:e122": "azorubine — carries an EU hyperactivity warning label",
  "en:e124": "ponceau 4R — carries an EU hyperactivity warning label",
  "en:e129": "allura red — carries an EU hyperactivity warning label",
  "en:e320": "BHA — IARC group 2B (possibly carcinogenic)",
  "en:e321": "BHT — bioaccumulation concern, under EFSA re-evaluation",
  "en:e249": "potassium nitrite — nitrosamine formation in cured meats (IARC)",
  "en:e250": "sodium nitrite — nitrosamine formation in cured meats (IARC)",
  "en:e251": "sodium nitrate — nitrosamine precursor",
  "en:e252": "potassium nitrate — nitrosamine precursor",
  "en:e951": "aspartame — IARC group 2B (2023)",
};

/** Non-sugar sweeteners: -0.5 if any present (WHO 2023 conditional guidance). */
const SWEETENER_PREFIXES = [
  "en:e950", "en:e951", "en:e952", "en:e954", "en:e955", "en:e957",
  "en:e959", "en:e960", "en:e961", "en:e962", "en:e969",
];

export function bandFor(score: number): Band {
  if (score >= 8.5) return "excellent";
  if (score >= 6.5) return "good";
  if (score >= 4.5) return "okay";
  if (score >= 2.5) return "poor";
  return "avoid";
}

export const BAND_LABEL: Record<Band, string> = {
  excellent: "Excellent",
  good: "Good",
  okay: "Okay",
  poor: "Poor",
  avoid: "Avoid",
};

const fmt = (x: number, digits = 1) =>
  Number.isFinite(x) ? String(Math.round(x * 10 ** digits) / 10 ** digits) : "?";

export function scoreFood(product: Product, context: MealContext): ScoreResult {
  const n = product.nutriments;
  const missing: string[] = [];
  const need = (x: number | undefined, name: string): number => {
    if (x === undefined) {
      missing.push(name);
      return 0;
    }
    return x;
  };

  const energyKj = need(n.energyKj, "energy");
  const sugars = need(n.sugars, "sugars");
  const satFat = need(n.saturatedFat, "saturated fat");
  const salt = need(n.salt, "salt");
  const protein = n.proteins ?? 0;
  const fiber = n.fiber ?? 0;
  const fruitPct = n.fruitsVegNutsPct ?? 0;

  const ePts = pts(energyKj, T.energyKj);
  const sPts = pts(sugars, T.sugars);
  const sfPts = pts(satFat, T.satFat);
  const saPts = pts(salt, T.salt);
  const prPts = pts(protein, T.protein);
  const fbPts = pts(fiber, T.fiber);
  const frPts = fruitPct > 80 ? 5 : fruitPct > 60 ? 2 : fruitPct > 40 ? 1 : 0;

  // Nutri-Score rule: protein doesn't count for high-negative products unless
  // they are mostly fruit/veg (stops sugary "protein" products from scoring well).
  const negUnweighted = ePts + sPts + sfPts + saPts;
  const proteinCounted = !(negUnweighted >= 11 && frPts < 5);

  // Context weighting (DESIGN.md 5.1 step 3): snacks are discretionary calories,
  // so sugar and energy density weigh 1.25x; meals should deliver protein and
  // fiber, so those weigh 1.25x.
  const wSnack = context === "snack" ? 1.25 : 1;
  const wMeal = context === "meal" ? 1.25 : 1;
  const neg = (ePts + sPts) * wSnack + sfPts + saPts;
  const pos = ((proteinCounted ? prPts : 0) + fbPts) * wMeal + frPts;
  const raw = neg - pos;
  const base = rawToBase(raw);

  // ---- Modifiers on the 10-point scale ----
  const modifiers: ScoreFactor[] = [];

  if ((n.transFat ?? 0) > 0.2) {
    modifiers.push({
      id: "trans-fat",
      label: "Contains trans fat",
      detail: `${fmt(n.transFat!)} g/100 g — WHO calls for eliminating industrial trans fat`,
      impact: -1.5,
      source: SRC.who,
    });
  }

  if (product.novaGroup === 4) {
    modifiers.push({
      id: "nova4",
      label: "Ultra-processed (NOVA 4)",
      detail: "Ultra-processed formulation of industrial ingredients",
      impact: -1.0,
      source: SRC.nova,
    });
  } else if (product.novaGroup === 3) {
    modifiers.push({
      id: "nova3",
      label: "Processed food (NOVA 3)",
      detail: "Processed with added salt, sugar or fat",
      impact: -0.5,
      source: SRC.nova,
    });
  }

  const concerns = product.additivesTags.filter((t) => ADDITIVES_OF_CONCERN[t]);
  if (concerns.length > 0) {
    const impact = -Math.min(concerns.length * 0.5, 1.5);
    modifiers.push({
      id: "additives",
      label: `Additive${concerns.length > 1 ? "s" : ""} of concern (${concerns.length})`,
      detail: concerns.map((t) => ADDITIVES_OF_CONCERN[t]).join("; "),
      impact,
      source: SRC.efsa,
    });
  }

  const sweeteners = product.additivesTags.filter((t) =>
    SWEETENER_PREFIXES.some((p) => t.startsWith(p))
  );
  if (sweeteners.length > 0) {
    modifiers.push({
      id: "sweeteners",
      label: "Non-sugar sweeteners",
      detail:
        "WHO (2023) advises against non-sugar sweeteners for weight control",
      impact: -0.5,
      source: SRC.who,
    });
  }

  // Per-serving caps (need a serving size to evaluate).
  const g = product.servingSizeG;
  if (g && g > 0) {
    const perServing = (per100: number | undefined) =>
      per100 === undefined ? undefined : (per100 * g) / 100;
    const kcal = perServing(n.energyKcal ?? (n.energyKj ? n.energyKj / 4.184 : undefined));
    const sugarServ = perServing(n.sugars);
    const sodiumServMg = n.salt === undefined ? undefined : (n.salt * 0.4 * 1000 * g) / 100;

    if (context === "snack") {
      if (kcal !== undefined && kcal > 250)
        modifiers.push({
          id: "serv-kcal",
          label: "Calorie-heavy snack serving",
          detail: `~${fmt(kcal, 0)} kcal per serving (snack cap: 250 kcal)`,
          impact: -0.5,
          source: SRC.rubric,
        });
      if (sugarServ !== undefined && sugarServ > 12)
        modifiers.push({
          id: "serv-sugar",
          label: "Sugar over snack cap",
          detail: `~${fmt(sugarServ, 0)} g sugar per serving (snack cap: 12 g)`,
          impact: -0.5,
          source: SRC.dga,
        });
      if (sodiumServMg !== undefined && sodiumServMg > 200)
        modifiers.push({
          id: "serv-sodium",
          label: "Sodium over snack cap",
          detail: `~${fmt(sodiumServMg, 0)} mg sodium per serving (snack cap: 200 mg)`,
          impact: -0.5,
          source: SRC.dga,
        });
    } else {
      if (sodiumServMg !== undefined && sodiumServMg > 800)
        modifiers.push({
          id: "serv-sodium",
          label: "Sodium over meal budget",
          detail: `~${fmt(sodiumServMg, 0)} mg sodium per serving (≥ 1/3 of the 2,300 mg daily limit)`,
          impact: -0.5,
          source: SRC.dga,
        });
    }
  }

  const modifierTotal = modifiers.reduce((sum, m) => sum + m.impact, 0);
  const clamped = Math.min(10, Math.max(1, base + modifierTotal));
  const score = Math.round(clamped * 2) / 2;
  const confidence: ScoreResult["confidence"] = missing.length >= 2 ? "partial" : "full";

  // ---- Headline drivers (worst first) ----
  const drivers: ScoreFactor[] = [];
  const drive = (
    cond: boolean, id: string, label: string, detail: string, impact: number, source: string
  ) => { if (cond) drivers.push({ id, label, detail, impact, source }); };

  drive(sPts >= 10, "sugar-vhigh", "Very high sugar",
    `${fmt(sugars)} g/100 g — WHO advises free sugars below 10% of energy`, -3, SRC.who);
  drive(sPts >= 5 && sPts < 10, "sugar-high", "High sugar",
    `${fmt(sugars)} g/100 g — WHO advises free sugars below 10% of energy`, -1.5, SRC.who);
  drive(sfPts >= 7, "satfat-vhigh", "Very high saturated fat",
    `${fmt(satFat)} g/100 g — DGA advises under 10% of daily calories`, -2.5, SRC.dga);
  drive(sfPts >= 4 && sfPts < 7, "satfat-high", "High saturated fat",
    `${fmt(satFat)} g/100 g — DGA advises under 10% of daily calories`, -1.2, SRC.dga);
  drive(saPts >= 8, "salt-vhigh", "Very high salt",
    `${fmt(salt)} g salt/100 g — daily limit is 2,300 mg sodium (~5.75 g salt)`, -2.5, SRC.dga);
  drive(saPts >= 4 && saPts < 8, "salt-high", "High salt",
    `${fmt(salt)} g salt/100 g — daily limit is 2,300 mg sodium (~5.75 g salt)`, -1.2, SRC.dga);
  drive(ePts >= 7, "energy-dense", "Very energy-dense",
    `${fmt(energyKj, 0)} kJ (${fmt(energyKj / 4.184, 0)} kcal) per 100 g`, -1, SRC.ns);
  drive(!proteinCounted && prPts > 0, "protein-not-counted", "Protein doesn't offset",
    "Protein credit is withheld when negative nutrients are this high", -0.1, SRC.ns);

  drive(frPts >= 2, "fruit-veg", "Mostly fruit / veg / nuts",
    `~${fmt(fruitPct, 0)}% fruit, vegetables, legumes or nuts`, +1.5, SRC.ns);
  drive(proteinCounted && prPts >= 4, "protein", "Good protein",
    `${fmt(protein)} g/100 g${context === "meal" ? " (weighted up for a meal)" : ""}`, +1.2, SRC.dga);
  drive(fbPts >= 3, "fiber", "Good fiber",
    `${fmt(fiber)} g/100 g${context === "meal" ? " (weighted up for a meal)" : ""}`, +1.2, SRC.dga);
  drive(
    sPts === 0 && sfPts === 0 && saPts === 0 && ePts <= 1 && drivers.length === 0,
    "clean-profile", "Clean nutrient profile",
    "Low in sugar, saturated fat and salt", +1, SRC.ns);

  drivers.push(...modifiers);
  if (missing.length > 0) {
    drivers.push({
      id: "missing",
      label: "Incomplete data",
      detail: `No data for: ${missing.join(", ")} (treated as 0 — the true score may be lower)`,
      impact: 0,
      source: "Open Food Facts",
    });
  }
  drivers.sort((a, b) => a.impact - b.impact);

  // ---- Full breakdown table ----
  const w = (weighted: boolean) => (weighted ? " ×1.25" : "");
  const breakdown: BreakdownRow[] = [
    { label: "Energy density", value: `${fmt(energyKj, 0)} kJ/100 g`, points: `+${fmt(ePts * wSnack)}${w(wSnack > 1)}`, source: SRC.ns },
    { label: "Sugars", value: `${fmt(sugars)} g/100 g`, points: `+${fmt(sPts * wSnack)}${w(wSnack > 1)}`, source: SRC.who },
    { label: "Saturated fat", value: `${fmt(satFat)} g/100 g`, points: `+${sfPts}`, source: SRC.dga },
    { label: "Salt", value: `${fmt(salt, 2)} g/100 g`, points: `+${saPts}`, source: SRC.dga },
    { label: "Protein", value: `${fmt(protein)} g/100 g`, points: proteinCounted ? `−${fmt(prPts * wMeal)}${w(wMeal > 1)}` : "not counted", source: SRC.ns },
    { label: "Fiber", value: `${fmt(fiber)} g/100 g`, points: `−${fmt(fbPts * wMeal)}${w(wMeal > 1)}`, source: SRC.dga },
    { label: "Fruit/veg/nuts", value: `~${fmt(fruitPct, 0)}%`, points: `−${frPts}`, source: SRC.ns },
    { label: "Raw points (higher = worse)", value: fmt(raw), points: `base ${fmt(base)}/10`, source: SRC.rubric },
    ...modifiers.map((m) => ({
      label: m.label,
      value: m.detail,
      points: `${m.impact > 0 ? "+" : "−"}${fmt(Math.abs(m.impact))} on final`,
      source: m.source,
    })),
  ];

  return {
    score,
    band: bandFor(score),
    context,
    base: Math.round(base * 10) / 10,
    raw: Math.round(raw * 10) / 10,
    drivers,
    modifiers,
    breakdown,
    confidence,
    missing,
    rubricVersion: RUBRIC_VERSION,
  };
}
