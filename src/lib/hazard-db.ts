import type { HazardTier } from "./types";

/**
 * Curated ingredient hazard database (DESIGN.md §4, §5.2), v1.
 * Compiled from primary sources: EU Cosmetics Regulation Annex II/III (CosIng),
 * FDA sunscreen monograph / GRASE determinations, IARC monographs, California
 * Prop 65, and SCCS opinions. Tiers: A = serious (-3.0), B = significant
 * concern (-1.5), C = mild concern (-0.5, capped at -2 total).
 */

export interface HazardEntry {
  id: string;
  /** lowercase INCI names and synonyms; matched longest-first on word boundaries */
  names: string[];
  tier: HazardTier;
  reason: string;
  source: string;
  /** only flag in leave-on products (e.g. SLS is fine in a rinse-off shampoo) */
  leaveOnOnly?: boolean;
  /** only flag in powders/sprays (inhalation route, e.g. talc, TiO2) */
  powderOnly?: boolean;
  /** downgraded tier when the product is rinse-off (e.g. MIT) */
  rinseOffTier?: HazardTier;
}

export const TIER_IMPACT: Record<HazardTier, number> = { A: -3.0, B: -1.5, C: -0.5 };
export const TIER_C_CAP = -2.0;

const ANNEX2 = "EU Cosmetics Regulation Annex II (banned)";
const ANNEX3 = "EU Cosmetics Regulation Annex III (restricted)";
const IARC = "IARC monographs";
const P65 = "California Prop 65";
const SCCS = "EU SCCS opinion";
const FDA_SUN = "FDA sunscreen monograph";

/** EU-declarable fragrance allergens (tier C each; the C cap keeps them from dominating). */
const FRAGRANCE_ALLERGENS = [
  "limonene", "linalool", "citronellol", "geraniol", "coumarin", "eugenol",
  "isoeugenol", "citral", "farnesol", "benzyl salicylate", "benzyl benzoate",
  "benzyl alcohol", "benzyl cinnamate", "hexyl cinnamal", "amyl cinnamal",
  "amylcinnamyl alcohol", "cinnamal", "cinnamyl alcohol", "anise alcohol",
  "alpha-isomethyl ionone", "hydroxycitronellal", "methyl 2-octynoate",
  "evernia prunastri", "evernia furfuracea",
];

export const HAZARD_DB: HazardEntry[] = [
  // ---- Tier A: banned in EU, IARC 1/2A, Prop 65, or equivalent ----
  { id: "formaldehyde", names: ["formaldehyde", "formalin", "methylene glycol"], tier: "A",
    reason: "known human carcinogen (IARC group 1); banned in EU cosmetics", source: `${IARC}; ${ANNEX2}` },
  { id: "dmdm-hydantoin", names: ["dmdm hydantoin"], tier: "A",
    reason: "formaldehyde-releasing preservative", source: SCCS },
  { id: "quaternium-15", names: ["quaternium-15"], tier: "A",
    reason: "formaldehyde-releasing preservative; no longer permitted in EU", source: ANNEX2 },
  { id: "diazolidinyl-urea", names: ["diazolidinyl urea"], tier: "A",
    reason: "formaldehyde-releasing preservative", source: SCCS },
  { id: "imidazolidinyl-urea", names: ["imidazolidinyl urea"], tier: "A",
    reason: "formaldehyde-releasing preservative", source: SCCS },
  { id: "bronopol", names: ["2-bromo-2-nitropropane-1,3-diol", "bronopol"], tier: "A",
    reason: "formaldehyde/nitrosamine-releasing preservative", source: SCCS },
  { id: "hydroxymethylglycinate", names: ["sodium hydroxymethylglycinate"], tier: "A",
    reason: "formaldehyde-releasing preservative", source: SCCS },
  { id: "hydroquinone", names: ["hydroquinone"], tier: "A",
    reason: "skin-bleaching agent banned in EU cosmetics (ochronosis risk)", source: ANNEX2 },
  { id: "mercury", names: ["thimerosal", "thiomersal", "phenylmercuric acetate", "calomel", "mercury"], tier: "A",
    reason: "mercury compound — neurotoxic; prohibited in most uses", source: ANNEX2 },
  { id: "lead-acetate", names: ["lead acetate"], tier: "A",
    reason: "lead compound; FDA repealed approval for hair dyes (2018)", source: P65 },
  { id: "coal-tar", names: ["coal tar"], tier: "A",
    reason: "known human carcinogen (IARC group 1)", source: `${IARC}; ${P65}` },
  { id: "lilial", names: ["butylphenyl methylpropional", "lilial"], tier: "A",
    reason: "fragrance banned in EU (2022) as presumed reprotoxic", source: ANNEX2 },
  { id: "lyral", names: ["hydroxyisohexyl 3-cyclohexene carboxaldehyde", "lyral"], tier: "A",
    reason: "fragrance banned in EU as an extreme sensitizer", source: ANNEX2 },
  { id: "dbp", names: ["dibutyl phthalate"], tier: "A",
    reason: "phthalate plasticizer banned in EU; developmental toxicant", source: `${ANNEX2}; ${P65}` },
  { id: "dehp", names: ["diethylhexyl phthalate", "di(2-ethylhexyl) phthalate"], tier: "A",
    reason: "phthalate banned in EU; carcinogen and reprotoxicant", source: `${ANNEX2}; ${P65}` },
  { id: "toluene", names: ["toluene"], tier: "A",
    reason: "solvent (nail products); developmental toxicant", source: P65 },
  { id: "benzophenone", names: ["benzophenone"], tier: "A",
    reason: "listed carcinogen (fragrance/UV stabilizer)", source: P65 },
  { id: "paba", names: ["para-aminobenzoic acid", "4-aminobenzoic acid", "paba"], tier: "A",
    reason: "UV filter banned in EU; delisted by FDA", source: `${ANNEX2}; ${FDA_SUN}` },
  { id: "banned-parabens", names: ["isopropylparaben", "isobutylparaben", "phenylparaben", "benzylparaben", "pentylparaben"], tier: "A",
    reason: "paraben banned in EU cosmetics", source: ANNEX2 },

  // ---- Tier B: suspected endocrine disruptors, IARC 2B, EU-restricted ----
  { id: "oxybenzone", names: ["oxybenzone", "benzophenone-3"], tier: "B",
    reason: "UV filter — endocrine-disruption concern; FDA says data insufficient for GRASE", source: `${SCCS}; ${FDA_SUN}` },
  { id: "octinoxate", names: ["ethylhexyl methoxycinnamate", "octyl methoxycinnamate", "octinoxate"], tier: "B",
    reason: "UV filter — endocrine-disruption concern; FDA says data insufficient for GRASE", source: `${SCCS}; ${FDA_SUN}` },
  { id: "homosalate", names: ["homosalate"], tier: "B",
    reason: "UV filter — SCCS found high concentrations unsafe (endocrine concern)", source: SCCS },
  { id: "octocrylene", names: ["octocrylene"], tier: "B",
    reason: "UV filter — degrades to benzophenone; sensitizer", source: `${SCCS}; ${FDA_SUN}` },
  { id: "padimate-o", names: ["padimate o", "ethylhexyl dimethyl paba"], tier: "B",
    reason: "PABA-derivative UV filter; FDA says data insufficient for GRASE", source: FDA_SUN },
  { id: "propylparaben", names: ["propylparaben"], tier: "B",
    reason: "longer-chain paraben — endocrine-disruption suspicion; EU concentration-restricted", source: `${SCCS}; ${ANNEX3}` },
  { id: "butylparaben", names: ["butylparaben"], tier: "B",
    reason: "longer-chain paraben — endocrine-disruption suspicion; EU concentration-restricted", source: `${SCCS}; ${ANNEX3}` },
  { id: "triclosan", names: ["triclosan"], tier: "B",
    reason: "antibacterial — endocrine-disruption suspicion; FDA banned in antiseptic washes", source: "FDA 2016 final rule; SCCS" },
  { id: "triclocarban", names: ["triclocarban"], tier: "B",
    reason: "antibacterial — FDA banned in antiseptic washes", source: "FDA 2016 final rule" },
  { id: "cyclic-silicones", names: ["cyclotetrasiloxane", "cyclopentasiloxane", "cyclohexasiloxane", "cyclomethicone"], tier: "B",
    reason: "cyclic silicone (D4/D5/D6) — D4 classified reprotoxic; EU restricted", source: "EU REACH restriction; SCCS" },
  { id: "bha-cosmetic", names: ["butylated hydroxyanisole", "bha"], tier: "B",
    reason: "possibly carcinogenic (IARC group 2B); endocrine concern", source: `${IARC}; ${P65}` },
  { id: "resorcinol", names: ["resorcinol"], tier: "B",
    reason: "hair-dye component — thyroid endocrine-disruption concern", source: SCCS },
  { id: "cocamide-dea", names: ["cocamide dea"], tier: "B",
    reason: "possibly carcinogenic (IARC group 2B)", source: `${IARC}; ${P65}` },
  { id: "diethanolamine", names: ["diethanolamine"], tier: "B",
    reason: "nitrosamine precursor; possibly carcinogenic (IARC 2B)", source: IARC },
  { id: "dep", names: ["diethyl phthalate"], tier: "B",
    reason: "phthalate (common fragrance carrier) — endocrine concern", source: SCCS },
  { id: "borates", names: ["boric acid", "sodium borate", "borax"], tier: "B",
    reason: "classified reprotoxic; EU concentration-restricted", source: `${SCCS}; ${ANNEX3}` },
  { id: "ppd", names: ["p-phenylenediamine", "paraphenylenediamine", "toluene-2,5-diamine"], tier: "B",
    reason: "hair-dye amine — potent sensitizer; EU concentration-restricted", source: ANNEX3 },
  { id: "carbon-black", names: ["carbon black", "ci 77266"], tier: "B",
    reason: "possibly carcinogenic (IARC group 2B)", source: `${IARC}; ${P65}` },
  { id: "mit", names: ["methylisothiazolinone"], tier: "B", rinseOffTier: "C",
    reason: "preservative banned in EU leave-on products (sensitization); allowed rinse-off", source: ANNEX3 },
  { id: "cmit", names: ["methylchloroisothiazolinone"], tier: "B", rinseOffTier: "C",
    reason: "preservative banned in EU leave-on products (sensitization); allowed rinse-off", source: ANNEX3 },

  // ---- Tier C: allergens, irritants, contamination risks ----
  { id: "fragrance", names: ["parfum", "fragrance", "perfume", "aroma"], tier: "C",
    reason: "undisclosed fragrance mixture — most common cosmetic allergen class", source: SCCS },
  { id: "peg", names: ["peg-"], tier: "C",
    reason: "ethoxylated compound — possible 1,4-dioxane contamination", source: "FDA guidance on 1,4-dioxane" },
  { id: "sls", names: ["sodium lauryl sulfate", "sodium dodecyl sulfate"], tier: "C", leaveOnOnly: true,
    reason: "irritant surfactant in a leave-on product", source: SCCS },
  { id: "sles", names: ["sodium laureth sulfate"], tier: "C", leaveOnOnly: true,
    reason: "ethoxylated surfactant in a leave-on product — 1,4-dioxane contamination risk", source: "FDA guidance on 1,4-dioxane" },
  { id: "triethanolamine", names: ["triethanolamine"], tier: "C",
    reason: "nitrosamine-formation potential; EU purity-restricted", source: ANNEX3 },
  { id: "bht-cosmetic", names: ["butylated hydroxytoluene", "bht"], tier: "C",
    reason: "antioxidant with bioaccumulation concern", source: SCCS },
  { id: "talc", names: ["talc"], tier: "C", powderOnly: true,
    reason: "inhalation concern in powders; asbestos-contamination history", source: IARC },
  { id: "tio2-powder", names: ["titanium dioxide", "ci 77891"], tier: "C", powderOnly: true,
    reason: "possibly carcinogenic by inhalation (IARC 2B) — powders/sprays only", source: IARC },
  { id: "mild-parabens", names: ["methylparaben", "ethylparaben"], tier: "C",
    reason: "short-chain paraben — SCCS considers safe at regulated limits; flagged for those avoiding parabens", source: SCCS },
  { id: "avobenzone", names: ["butyl methoxydibenzoylmethane", "avobenzone"], tier: "C",
    reason: "UV filter — photo-unstable; FDA requested more safety data", source: FDA_SUN },
  { id: "octisalate", names: ["ethylhexyl salicylate", "octisalate"], tier: "C",
    reason: "UV filter — FDA requested more safety data", source: FDA_SUN },
  { id: "ensulizole", names: ["phenylbenzimidazole sulfonic acid", "ensulizole"], tier: "C",
    reason: "UV filter — FDA requested more safety data", source: FDA_SUN },
  { id: "benzophenone-4", names: ["benzophenone-4", "sulisobenzone"], tier: "C",
    reason: "benzophenone-class UV filter", source: FDA_SUN },
  ...FRAGRANCE_ALLERGENS.map((name) => ({
    id: `allergen-${name.replace(/[^a-z0-9]+/g, "-")}`,
    names: [name],
    tier: "C" as HazardTier,
    reason: "declarable fragrance allergen",
    source: ANNEX3,
  })),
];

/** Beneficial actives recognized per category (positive notes, no deduction). */
export const FLUORIDES = ["sodium fluoride", "stannous fluoride", "sodium monofluorophosphate", "olaflur"];
export const MINERAL_UV_FILTERS = ["zinc oxide", "titanium dioxide", "ci 77891"];

/**
 * Common INCI ingredients considered unremarkable — used only so the
 * "% unrecognized" confidence heuristic is meaningful, never for scoring.
 * Matched by startsWith.
 */
export const COMMON_SAFE: string[] = [
  "aqua", "water", "eau", "glycerin", "glycerine", "glycerol",
  "butylene glycol", "propylene glycol", "propanediol", "pentylene glycol",
  "caprylyl glycol", "hexylene glycol", "dipropylene glycol",
  "dimethicone", "dimethiconol", "amodimethicone",
  "cetyl alcohol", "cetearyl alcohol", "stearyl alcohol", "behenyl alcohol", "myristyl alcohol",
  "alcohol denat", "alcohol", "ethanol",
  "stearic acid", "palmitic acid", "myristic acid", "lauric acid", "oleic acid", "linoleic acid",
  "glyceryl stearate", "glyceryl caprylate", "glyceryl oleate", "glyceryl behenate",
  "caprylic/capric triglyceride", "squalane", "squalene",
  "niacinamide", "panthenol", "tocopherol", "tocopheryl acetate",
  "ascorbic acid", "ascorbyl glucoside", "sodium ascorbyl phosphate",
  "hyaluronic acid", "sodium hyaluronate", "allantoin", "bisabolol", "urea",
  "lactic acid", "glycolic acid", "salicylic acid", "citric acid", "sodium citrate",
  "sodium chloride", "sodium gluconate", "sodium phytate", "phytic acid",
  "sodium hydroxide", "potassium hydroxide",
  "potassium sorbate", "sodium benzoate", "benzoic acid", "sorbic acid",
  "dehydroacetic acid", "sodium dehydroacetate",
  "phenoxyethanol", "ethylhexylglycerin", "chlorphenesin",
  "decyl glucoside", "coco-glucoside", "lauryl glucoside",
  "cocamidopropyl betaine", "coco-betaine", "sodium cocoyl isethionate",
  "sodium methyl cocoyl taurate", "sodium lauroyl sarcosinate",
  "sodium cocoyl glutamate", "disodium cocoyl glutamate", "sodium lauroyl methyl isethionate",
  "disodium edta", "tetrasodium edta", "trisodium ethylenediamine disuccinate",
  "xanthan gum", "sclerotium gum", "cellulose gum", "hydroxyethylcellulose",
  "carbomer", "acrylates", "polyacrylate", "sodium polyacrylate",
  "mica", "silica", "hydrated silica", "kaolin", "bentonite", "magnesium aluminum silicate",
  "calcium carbonate", "sodium bicarbonate", "zinc oxide", "iron oxides",
  "zinc pca", "sodium pca", "betaine", "trehalose", "arginine", "glycine",
  "cholesterol", "lecithin", "hydrogenated lecithin", "phytosphingosine",
  "caffeine", "adenosine", "retinol", "bakuchiol", "ubiquinone",
  "petrolatum", "paraffinum liquidum", "mineral oil", "cera alba", "beeswax",
  "cera microcristallina", "microcrystalline wax", "ozokerite", "ceresin", "lanolin",
  "isopropyl myristate", "isopropyl palmitate", "ethylhexyl palmitate", "ethylhexyl stearate",
  "c12-15 alkyl benzoate", "dicaprylyl carbonate", "dicaprylyl ether", "coco-caprylate",
  "octyldodecanol", "isononyl isononanoate",
  "behentrimonium chloride", "cetrimonium chloride", "stearamidopropyl dimethylamine",
  "guar hydroxypropyltrimonium chloride", "hydroxypropyl guar", "hydrolyzed",
  "ceramide", "polyquaternium", "polysorbate", "polyglyceryl",
  "sodium fluoride", "stannous fluoride", "sodium monofluorophosphate", "olaflur",
  "hydroxyapatite", "sorbitol", "xylitol", "erythritol", "sodium saccharin", "sucralose",
  "menthol", "zinc citrate", "zinc gluconate", "tin oxide", "alumina", "aluminum hydroxide",
  "aluminum starch", "magnesium sulfate", "magnesium stearate", "maltodextrin", "dextrin",
  "tromethamine", "aminomethyl propanol", "aluminum chlorohydrate",
  // modern EU/SCCS-reviewed UV filters (low skin penetration)
  "bis-ethylhexyloxyphenol methoxyphenyl triazine", "diethylamino hydroxybenzoyl hexyl benzoate",
  "ethylhexyl triazone", "diethylhexyl butamido triazone", "phenylene bis-diphenyltriazine",
  "methylene bis-benzotriazolyl tetramethylbutylphenol", "tris-biphenyl triazine",
  "terephthalylidene dicamphor sulfonic acid", "drometrizole trisiloxane",
  // common emulsifiers/film formers
  "potassium cetyl phosphate", "sorbitan", "tribehenin", "glyceryl", "polyisobutene",
  "hydrogenated polyisobutene", "vp", "eicosene copolymer", "caprylic", "capric triglyceride",
];

/** Botanical/derivative pattern — counts as recognized for the confidence check. */
export const BOTANICAL_RE =
  /\b(extract|oil|butter|juice|water|wax|starch|powder|leaf|seed|root|flower|fruit|kernel|bark|peel|germ|resin|gum|protein|ferment|filtrate|honey|milk)\b/;

/** Colorants — CI numbers ("ci 77491") or US names ("red 33", "fd&c blue 1"). */
export const COLORANT_RE =
  /^(ci \d{5}|(fd&c |d&c )?(red|blue|yellow|green|orange|violet|ext\.? ?d&c red) ?(no\.? ?)?\d+)/;
