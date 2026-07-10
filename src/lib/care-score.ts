import {
  BOTANICAL_RE,
  COLORANT_RE,
  COMMON_SAFE,
  FLUORIDES,
  HAZARD_DB,
  MINERAL_UV_FILTERS,
  TIER_C_CAP,
  TIER_IMPACT,
  type HazardEntry,
} from "./hazard-db";
import { bandFor } from "./food-score";
import type {
  BeautyProduct,
  CareKind,
  CareScoreResult,
  FlaggedIngredient,
} from "./types";

export const CARE_RUBRIC_VERSION = "1.0";

/** Split an ingredients label into tokens, respecting parentheses. */
export function splitIngredients(text: string): string[] {
  const cleaned = text.replace(/^\s*ingredients?\s*:/i, "");
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of cleaned) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth = Math.max(0, depth - 1);
    if ((ch === "," || ch === ";" || ch === "·" || ch === "•") && depth === 0) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out
    .map((s) => s.replace(/[*†.]+$/g, "").replace(/\s+/g, " ").trim().toLowerCase())
    .filter((s) => s.length > 1);
}

const SUNSCREEN_TAGS = ["en:sunscreens", "en:suncare", "en:sun-protection", "en:sun-creams"];
const ORAL_TAGS = ["en:toothpastes", "en:dentifrices", "en:oral-hygiene", "en:mouthwashes", "en:oral-care"];
const RINSE_OFF_TAGS = [
  "en:shampoos", "en:hair-conditioners", "en:shower-gels", "en:soaps", "en:bar-soaps",
  "en:cleansers", "en:facial-cleansers", "en:face-washes", "en:hand-washes",
  "en:bubble-baths", "en:body-washes", "en:makeup-removers",
];

export interface CareCategory {
  kind: CareKind;
  /** powder or aerosol form — inhalation-route flags apply */
  powder: boolean;
  label: string;
}

export function classifyCare(product: BeautyProduct): CareCategory {
  const tags = product.categoriesTags;
  const name = product.name.toLowerCase();
  const hasTag = (list: string[]) => tags.some((t) => list.includes(t));
  const powder =
    tags.some((t) => /powder|spray|aerosol/.test(t)) || /\b(powder|spray)\b/.test(name);

  if (hasTag(SUNSCREEN_TAGS) || /\bspf\s*\d|sunscreen|sun\s?(milk|cream|lotion)/.test(name))
    return { kind: "sunscreen", powder, label: "sunscreen" };
  if (hasTag(ORAL_TAGS) || /toothpaste|mouthwash|dentifrice/.test(name))
    return { kind: "oral", powder, label: "oral care" };
  if (hasTag(RINSE_OFF_TAGS) || /shampoo|body wash|shower gel|face wash|cleanser|hand soap/.test(name))
    return { kind: "rinse-off", powder, label: "rinse-off (washed away)" };
  return { kind: "leave-on", powder, label: "leave-on (stays on skin)" };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface NamedEntry {
  name: string;
  prefix: boolean;
  entry: HazardEntry;
  re: RegExp | null;
}

// Flatten to (name, entry) pairs sorted longest-first so the most specific
// synonym wins (e.g. "benzophenone-3" -> oxybenzone, not plain benzophenone).
const NAME_INDEX: NamedEntry[] = HAZARD_DB.flatMap((entry) =>
  entry.names.map((name) => ({
    name,
    prefix: name.endsWith("-"),
    entry,
    re: name.endsWith("-")
      ? null
      : new RegExp(`(^|[^a-z0-9])${escapeRe(name)}($|[^a-z0-9])`),
  }))
).sort((a, b) => b.name.length - a.name.length);

function matchHazard(token: string): HazardEntry | null {
  for (const { name, prefix, entry, re } of NAME_INDEX) {
    if (prefix ? new RegExp(`(^|[^a-z0-9])${escapeRe(name)}\\d`).test(token) : re!.test(token))
      return entry;
  }
  return null;
}

function isRecognized(token: string): boolean {
  if (COLORANT_RE.test(token) || BOTANICAL_RE.test(token)) return true;
  return COMMON_SAFE.some((name) => token.startsWith(name));
}

function tierFor(entry: HazardEntry, cat: CareCategory): FlaggedIngredient["tier"] | null {
  if (entry.leaveOnOnly && cat.kind !== "leave-on") return null;
  if (entry.powderOnly && !cat.powder) return null;
  if (entry.rinseOffTier && (cat.kind === "rinse-off" || cat.kind === "oral"))
    return entry.rinseOffTier;
  return entry.tier;
}

export function scoreCare(product: BeautyProduct): CareScoreResult {
  const cat = classifyCare(product);
  const tokens = product.ingredients.length
    ? product.ingredients
    : splitIngredients(product.ingredientsText ?? "");

  const flagged: FlaggedIngredient[] = [];
  const unknown: string[] = [];
  const seen = new Set<string>();
  const present = (names: string[]) =>
    tokens.some((t) => names.some((n) => t.includes(n)));

  for (const token of tokens) {
    const entry = matchHazard(token);
    if (entry) {
      const tier = tierFor(entry, cat);
      if (tier && !seen.has(entry.id)) {
        seen.add(entry.id);
        flagged.push({
          ingredient: token,
          entryId: entry.id,
          label: entry.names[0],
          tier,
          reason: entry.reason,
          source: entry.source,
          impact: TIER_IMPACT[tier],
        });
      }
      continue;
    }
    if (!isRecognized(token)) unknown.push(token);
  }

  const tierTotal = (tier: string) =>
    flagged.filter((f) => f.tier === tier).reduce((s, f) => s + f.impact, 0);
  const deduction =
    tierTotal("A") + tierTotal("B") + Math.max(tierTotal("C"), TIER_C_CAP);
  const score = Math.max(1, Math.round((10 + deduction) * 2) / 2);

  flagged.sort((a, b) => a.impact - b.impact);

  // ---- Category-aware positives ----
  const positives: CareScoreResult["positives"] = [];
  if (cat.kind === "oral" && present(FLUORIDES)) {
    positives.push({
      label: "Fluoride ✓",
      detail: "Proven cavity prevention — a beneficial active in oral care",
      source: "FDA OTC anticaries monograph",
    });
  }
  if (cat.kind === "sunscreen" && present(MINERAL_UV_FILTERS)) {
    positives.push({
      label: "Mineral UV filter ✓",
      detail: "Zinc oxide / titanium dioxide are the two FDA GRASE (recognized safe and effective) sunscreen filters",
      source: "FDA sunscreen monograph",
    });
  }

  const notes: string[] = [];
  if (cat.kind === "sunscreen") {
    notes.push(
      "Any sunscreen beats no sunscreen. This score compares sunscreens to each other — never skip sun protection over it."
    );
  }

  const unknownRatio = tokens.length > 0 ? unknown.length / tokens.length : 1;
  const confidence = unknownRatio > 0.3 ? "partial" : "full";

  return {
    score,
    band: bandFor(score),
    kind: cat.kind,
    kindLabel: cat.label,
    flagged,
    positives,
    notes,
    unknown,
    totalIngredients: tokens.length,
    confidence,
    rubricVersion: CARE_RUBRIC_VERSION,
  };
}
