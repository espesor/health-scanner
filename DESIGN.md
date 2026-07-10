# Health Scanner — Design Document

**Product:** A mobile web app that scans a food or personal-care product with the phone camera, identifies it, and grades its healthiness 1–10 with a clear explanation.

**Status:** Draft v1 · 2026-07-09

---

## 1. Goals and non-goals

### Goals
- Point the phone camera at a product and get an answer in under ~5 seconds for barcode hits, under ~15 seconds for OCR/photo fallback.
- Identify products three ways, in order of reliability: **barcode → ingredients-label OCR → product photo recognition** (name / logo / packaging).
- Grade **food** against official dietary guidelines, adjusted for whether it's eaten as a **snack or a meal**.
- Grade **personal-care / health products** (sunscreen, lotion, toothpaste, shampoo, deodorant…) by counting and weighting **ingredients of concern** against regulatory and scientific hazard lists.
- Produce a **1–10 score** (10 = healthiest) from a transparent, reproducible rubric — plus a plain-language explanation of *why*, citing the specific nutrients or ingredients that drove the score.
- Run as a **PWA**: no app-store install, works on iOS Safari and Android Chrome.

### Non-goals (v1)
- Medical advice, allergy safety guarantees, or personalized nutrition plans.
- Offline scoring (requires network for product lookup and analysis).
- Non-packaged foods (restaurant meals, produce without labels).
- Native apps.

---

## 2. User flow

```
Open app → camera view opens immediately
   │
   ├─ 1. Barcode detected in frame ──────────→ lookup by barcode
   ├─ 2. No barcode: user taps "Scan label" ─→ photo of ingredients/nutrition panel → OCR
   └─ 3. Neither: user taps "Identify" ──────→ photo of front of package → vision model ID
   │
   ▼
Product identified? ──no──→ show best guesses, let user pick or retry
   │ yes
   ▼
Classify: FOOD or PERSONAL CARE  (from product category; user can override)
   │
   ├─ FOOD: ask one question if ambiguous — "Snack or meal?" (pre-answered from category when obvious, e.g., candy bar = snack, frozen lasagna = meal)
   │
   ▼
Score card: big 1–10 number, color band, grade label
   ├─ "Why this score" — 3–6 bullet drivers (worst offenders first)
   ├─ Metric breakdown — expandable table of every scored component
   ├─ Sources — which guideline/database each judgment came from
   └─ History — scan is saved locally for later review
```

Key UX decisions:
- **Camera-first.** The camera is the home screen. Barcode detection runs continuously on the live stream; no shutter press needed for barcodes.
- **One clarifying question max.** Snack-vs-meal is the only prompt, and only when the category doesn't already answer it.
- **Score must be explainable.** Every point deducted or awarded maps to a named metric the user can expand and read.

---

## 3. Product identification pipeline

Three stages, tried in order; each stage falls through to the next on failure.

### Stage 1 — Barcode (fastest, most reliable)
- **Client:** `BarcodeDetector` API where available (Android Chrome); fallback to a WASM decoder (`zxing-wasm` or `quagga2`) for iOS Safari. Runs on downscaled video frames at ~10 fps.
- Formats: EAN-13, EAN-8, UPC-A, UPC-E.
- **Lookup:** backend queries, in order:
  1. **Open Food Facts** (food) / **Open Beauty Facts** (personal care) — free, open, ~3M products, returns ingredients, nutrition facts per 100 g, NOVA group, additives.
  2. **USDA FoodData Central** (branded foods, US) — authoritative nutrition panels.
  3. Local cache of previously scanned products.
- If lookup returns a product but with incomplete data (e.g., no ingredients list), prompt the user to photograph the label → merge OCR data in, and (optionally, with consent) contribute it back to Open Food Facts.

### Stage 2 — Ingredients / nutrition label OCR
- User photographs the ingredients list and/or nutrition facts panel.
- Image is sent to the backend; a **vision LLM (Claude, `claude-fable-5` or `claude-sonnet-5`)** extracts a structured JSON: ingredient list (ordered), nutrition facts (per serving and per 100 g when present), serving size, allergen statements. A vision LLM outperforms classical OCR (Tesseract) here because labels are curved, glossy, multi-column, and multilingual, and the model can normalize units and fix OCR-style errors in one step.
- Extraction prompt returns a strict JSON schema; low-confidence fields are flagged and shown to the user for one-tap confirmation.

### Stage 3 — Product photo recognition
- User photographs the front of the package. The vision LLM identifies brand + product name + category from logo/artwork/text.
- The guessed name is searched against Open Food Facts / Open Beauty Facts full-text search; top 3 candidates shown as tappable cards with thumbnails. User confirms.
- If nothing matches, fall back to Stage 2 (label OCR) for a "generic" analysis: we can still score from ingredients + nutrition alone without knowing the exact SKU.

---

## 4. Authoritative data sources

### Dietary guidelines (food scoring thresholds)
| Source | Used for |
|---|---|
| **Dietary Guidelines for Americans 2020–2025** (dietaryguidelines.gov, USDA/HHS) | Added-sugar <10% kcal, sat-fat <10% kcal, sodium <2,300 mg/day; food-group framing |
| **FDA Daily Values** (fda.gov) | %DV thresholds: ≥20% DV "high", ≤5% DV "low" per nutrient |
| **WHO guidelines** (who.int) | Free sugars <10% (ideally <5%) of energy; sodium <2 g/day; trans fat elimination |
| **Nutri-Score algorithm, 2023 update** (Santé publique France) | Basis for the nutrient-profile point math (energy, sugars, sat fat, sodium vs. fiber, protein, fruit/veg %) |
| **NOVA classification** (Univ. of São Paulo; carried in Open Food Facts) | Ultra-processing penalty |
| **EFSA / EU additive evaluations** | Additives-of-concern list |

### Personal-care ingredient hazards
| Source | Used for |
|---|---|
| **EU Cosmetics Regulation Annex II/III** (banned & restricted substances — CosIng database) | Tier-A/B classification: an ingredient banned or restricted in the EU is a strong hazard signal even for US products |
| **FDA sunscreen monograph & GRASE determinations** | Sunscreen filters: zinc oxide/titanium dioxide = GRASE; oxybenzone, octinoxate etc. flagged as "insufficient data" |
| **California Prop 65 list** (OEHHA) | Carcinogen / reproductive-toxicant flags |
| **IARC monographs** | Carcinogenicity classes 1 / 2A / 2B |
| **EU SCCS opinions** | Endocrine-disruptor suspects (e.g., homosalate, propylparaben concentration limits) |
| **EWG Skin Deep methodology** (reference only) | Cross-check; we do not scrape EWG scores, we build our own from primary lists |

**Implementation:** these are compiled offline into a versioned **ingredient hazard database** (a curated JSON/SQLite file shipped with the backend, ~2,000 flagged ingredients with INCI-name synonyms, hazard tier, category, and citation URL). Rebuilt periodically by a maintenance script; scoring at runtime never depends on live scraping of authority sites. Each flagged ingredient stores the citation shown to the user.

---

## 5. Grading system: HealthScore 1–10

Both tracks output a score on the same scale so the UI is uniform:

| Score | Band | Label |
|---|---|---|
| 9–10 | Green | Excellent |
| 7–8 | Light green | Good |
| 5–6 | Yellow | Okay |
| 3–4 | Orange | Poor |
| 1–2 | Red | Avoid |

Scores are always shown with the context they were computed under (e.g., "7/10 *as a snack*").

### 5.1 Food scoring

**Step 1 — Nutrient profile (0–100 raw points), Nutri-Score-2023-style, computed per 100 g:**

*Negative points (0–40):*
| Metric | Full penalty at | Source |
|---|---|---|
| Energy density | ≥ 3,350 kJ/100 g | Nutri-Score |
| Total sugars | ≥ 51 g/100 g | WHO / DGA |
| Saturated fat | ≥ 10 g/100 g | DGA / FDA DV |
| Sodium | ≥ 4 g salt/100 g | DGA / WHO |
| Trans fat (if declared) | any artificial trans fat = automatic −10 raw | WHO |

*Positive points (0–25):*
| Metric | Full credit at |
|---|---|
| Fiber | ≥ 7.4 g/100 g |
| Protein | ≥ 17 g/100 g |
| Fruit/veg/legume/nut content | ≥ 80% |

**Step 2 — Processing & additives modifiers:**
- NOVA group 4 (ultra-processed): **−1.0** on the 10-point scale; NOVA 3: −0.5.
- Each additive on the concern list (e.g., titanium dioxide E171, certain azo dyes, aspartame, BHA/BHT, sodium nitrite): **−0.5**, capped at **−1.5** total.
- Non-caloric sweeteners present: −0.5 (WHO 2023 conditional guidance).

**Step 3 — Snack vs. meal context.** The same nutrient density is judged differently depending on role:

- **Meal context:** scored per 100 g against meal-appropriate expectations — a meal *should* carry calories, protein, fiber. Sodium threshold per serving: a meal may reasonably use up to ~800 mg (≈1/3 of daily 2,300 mg). Protein and fiber positives get **1.25× weight** (a meal that lacks them is a worse meal).
- **Snack context:** snacks are discretionary calories, so thresholds tighten: sugar and energy-density penalties get **1.25× weight**, and per-serving caps apply — a snack serving >250 kcal, >200 mg sodium, or >12 g added sugar takes an extra −0.5 each. Fresh fruit/nuts naturally score high here; candy and chips score low.
- Context is auto-set from product category (Open Food Facts categories map cleanly: confectionery/chips/biscuits → snack; ready-meals/pasta/soups → meal) and user-overridable with one tap.

**Step 4 — Map to 1–10.** Raw nutrient-profile points → base score 1–10 (linear bands, calibrated so Nutri-Score A ≈ 8–10, B ≈ 7, C ≈ 5–6, D ≈ 3–4, E ≈ 1–2), then apply Step-2/3 modifiers, clamp to [1, 10], round to nearest 0.5.

**Worked example — chocolate sandwich cookie (snack):** high sugar (38 g/100 g) and sat fat → base 2.5; NOVA 4 → −1.0; palm-oil emulsifiers + soy lecithin (not on concern list, no penalty); snack sugar-per-serving cap exceeded → −0.5. **Score: 1/10 (clamped), "Avoid."**

**Worked example — plain Greek yogurt (snack):** low sugar, high protein (10 g/100 g) → base 8.5; NOVA 1 → no penalty. **Score: 8.5 → displayed 8.5/10, "Good/Excellent."**

### 5.2 Personal-care scoring

Start at **10**, deduct per flagged ingredient found in the (parsed, INCI-normalized) ingredient list:

| Tier | Definition | Examples | Deduction |
|---|---|---|---|
| **A — Serious** | Banned in EU (Annex II), IARC 1/2A, Prop 65 listed, or FDA "not GRASE + safety signal" | formaldehyde & releasers (DMDM hydantoin, quaternium-15), coal-tar dyes, benzene contamination classes, mercury compounds | **−3.0 each** |
| **B — Significant concern** | Suspected endocrine disruptor (SCCS/EU review), restricted concentration in EU, IARC 2B | oxybenzone, homosalate (above EU limits), triclosan, propyl-/butylparaben, cyclic silicones D4/D5, chemical UV filters pending FDA data | **−1.5 each** |
| **C — Mild concern** | Common allergen/irritant/sensitizer, or ecological concern | undisclosed "fragrance/parfum", MIT/CMIT preservatives, essential-oil allergens (limonene, linalool), PEGs (contamination risk), SLS in leave-on products | **−0.5 each** |

Rules:
- Deductions **cap at −9** (floor score = 1).
- Tier-C deductions cap at **−2** total (so a product can't score "Avoid" purely on fragrance allergens).
- **Category awareness:** deductions only apply where the concern is relevant to the product's use — e.g., fluoride is *positive* in toothpaste (+0 penalty, noted as beneficial) though it'd be flagged in a lip balm; SLS penalized in leave-on lotion but not in rinse-off shampoo; mineral sunscreen filters (zinc oxide, titanium dioxide non-nano) earn a "GRASE ✓" positive note.
- **Unknown ingredients** (not in database, not obviously botanical/common): no penalty, but listed as "not evaluated" for transparency. If >30% of the list is unrecognized, the score is shown with a "low confidence" badge.
- **Sunscreen disclaimer, always shown:** any sunscreen beats no sunscreen; the score compares sunscreens *to each other*, not to skipping sun protection.

**Worked example — sunscreen with oxybenzone + octinoxate + fragrance:** 10 − 1.5 − 1.5 − 0.5 = **6.5/10, "Okay"** — with the note "Choose a zinc-oxide mineral formula to score 9+."

### 5.3 Explanation generation

The scoring engine is **deterministic** — pure rules, no LLM in the math (reproducible, auditable, cheap). The LLM's job is narration: it receives the computed score object (every metric, its value, its threshold, its point impact, its citation) and writes the 3–6 bullet "Why this score" in plain language, strictly grounded in that object ("Explain only from the provided metrics; do not add claims"). Temperature low; bullet drivers ordered by |point impact|.

---

## 6. Architecture

```
┌─────────────────────────────  Phone (PWA)  ─────────────────────────────┐
│ React + Vite + TypeScript, installable PWA (manifest + service worker)  │
│ • Camera: getUserMedia → live <video>                                    │
│ • Barcode: BarcodeDetector API / zxing-wasm fallback (on-device)         │
│ • Photo capture (label / package) → resized JPEG upload                  │
│ • Score card UI, scan history (IndexedDB, local-only)                    │
└───────────────┬──────────────────────────────────────────────────────────┘
                │ HTTPS (camera requires secure context)
┌───────────────▼──────────────  Backend (Node/TypeScript, Fastify)  ──────┐
│ POST /api/scan/barcode   {ean}            → product + score              │
│ POST /api/scan/label     {image}          → extracted data + score       │
│ POST /api/scan/identify  {image}          → candidate products           │
│ POST /api/score          {product, context} → score object + explanation │
│                                                                           │
│ ┌─ Product resolver ──────────┐  ┌─ Scoring engine (deterministic) ────┐ │
│ │ Open Food Facts / Open      │  │ food-score.ts    (rubric §5.1)      │ │
│ │ Beauty Facts / USDA FDC     │  │ care-score.ts    (rubric §5.2)      │ │
│ │ clients + Redis/SQLite cache│  │ hazard-db.sqlite (versioned, §4)    │ │
│ └─────────────────────────────┘  └─────────────────────────────────────┘ │
│ ┌─ Vision/LLM service (Claude API) ─────────────────────────────────────┐│
│ │ • label extraction → strict JSON   • product ID from photo            ││
│ │ • explanation narration from score object                             ││
│ └───────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

Notes:
- **Why a backend at all:** keeps the Anthropic API key off the client, caches product lookups (Open Food Facts asks for caching and rate courtesy), and hosts the hazard DB + scoring so rubric updates don't require client redeploys.
- **Caching:** product lookups cached 30 days by barcode; score objects cached by (product-version, rubric-version, context) so repeat scans are instant and free.
- **Rubric versioning:** every score records `rubricVersion`; when thresholds change, history entries can show "scored under v1".
- **Images** are processed transiently and not stored server-side (privacy; see §8).

### Tech stack summary
| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite, PWA | Fast dev, installable, camera APIs well-supported |
| Barcode | BarcodeDetector API + zxing-wasm fallback | Native speed on Android, universal coverage on iOS |
| Backend | Node + Fastify + TypeScript | Shared types with frontend, light footprint |
| Product data | Open Food Facts, Open Beauty Facts, USDA FDC | Free, open, ingredient + nutrition + NOVA data |
| OCR / vision / narration | Claude API (`claude-fable-5` for vision extraction & ID, `claude-haiku-4-5` acceptable for narration) | One model family handles OCR-quality extraction, logo/product ID, and grounded explanation |
| Storage | SQLite (hazard DB, product cache), IndexedDB (client history) | Zero-ops for v1 |

---

## 7. Score card UI (sketch)

```
┌──────────────────────────────┐
│  Oreo Chocolate Sandwich     │
│  Cookies · Nabisco           │
│                              │
│        ┌────────┐            │
│        │  1/10  │  ● Avoid   │   ← big number, red band
│        └────────┘            │
│        as a snack ▾          │   ← context chip, tap to switch
│                              │
│  Why this score              │
│  ▸ Very high sugar: 38 g per │
│    100 g — WHO advises free  │
│    sugars <10% of energy     │
│  ▸ Ultra-processed (NOVA 4)  │
│  ▸ High saturated fat (palm  │
│    oil): 9 g/100 g           │
│  ▸ One serving = 14 g added  │
│    sugar, over the snack cap │
│                              │
│  ▸ Full metric breakdown     │   ← expandable table w/ citations
│  ▸ Healthier alternatives    │   (v2)
└──────────────────────────────┘
```

---

## 8. Privacy, safety, and disclaimers

- **Photos:** uploaded over HTTPS, processed in memory, never persisted server-side. Stated in the UI.
- **History:** stored only on-device (IndexedDB). No accounts in v1.
- **Disclaimers (persistent footer + first-run screen):** informational only, not medical advice; scores reflect published guidelines and hazard lists, not individual health needs; allergen info may be incomplete — always read the physical label; sunscreen note per §5.2.
- **Data licensing:** Open Food Facts is ODbL — attribution shown on every product card; user-contributed label photos (opt-in) shared back under compatible terms.

---

## 9. Milestones

| # | Milestone | Scope |
|---|---|---|
| M1 | Barcode → food score | Camera + barcode scan, OFF lookup, food rubric, score card. The end-to-end happy path. |
| M2 | Personal care | Open Beauty Facts lookup, hazard DB v1 (~top 500 flagged ingredients), care rubric |
| M3 | Label OCR fallback | Claude vision extraction, confirm-and-correct UI |
| M4 | Photo identification | Front-of-pack ID, candidate picker |
| M5 | Polish | Snack/meal auto-detection tuning, history, PWA install prompt, alternatives ("score 9+ instead") |

## 10. Open questions
1. Region: US guidelines (DGA/FDA) as primary with WHO as backstop — confirm target market is US.
2. Should low-confidence scores (sparse data) show a numeric score at all, or a "?" with partial findings?
3. Monetization/API budget ceiling — affects whether Stage-2/3 vision calls need per-user rate limits in v1.
