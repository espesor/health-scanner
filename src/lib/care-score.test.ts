import { describe, expect, it } from "vitest";
import { classifyCare, scoreCare, splitIngredients } from "./care-score";
import type { BeautyProduct } from "./types";

function product(overrides: Partial<BeautyProduct>): BeautyProduct {
  return {
    barcode: "0000000000000",
    name: "Test product",
    categoriesTags: [],
    ingredients: [],
    ...overrides,
  };
}

describe("scoreCare", () => {
  it("matches the design worked example: oxybenzone + octinoxate + fragrance sunscreen = 6.5", () => {
    const r = scoreCare(
      product({
        name: "Sunscreen SPF 50",
        categoriesTags: ["en:sunscreens"],
        ingredients: ["aqua", "oxybenzone", "ethylhexyl methoxycinnamate", "parfum", "glycerin"],
      })
    );
    expect(r.score).toBe(6.5);
    expect(r.band).toBe("okay");
    expect(r.kind).toBe("sunscreen");
    expect(r.notes.some((n) => n.includes("no sunscreen"))).toBe(true);
  });

  it("deducts 3 points for a tier-A formaldehyde releaser", () => {
    const r = scoreCare(
      product({ ingredients: ["aqua", "glycerin", "dmdm hydantoin"] })
    );
    expect(r.score).toBe(7);
    expect(r.flagged[0].tier).toBe("A");
  });

  it("caps tier-C deductions at -2 so fragrance allergens can't tank a score", () => {
    const r = scoreCare(
      product({
        ingredients: [
          "aqua", "parfum", "limonene", "linalool", "citronellol", "geraniol", "coumarin", "eugenol",
        ],
      })
    );
    expect(r.score).toBe(8); // 7 C-flags -> -3.5 uncapped, capped at -2
  });

  it("floors the score at 1", () => {
    const r = scoreCare(
      product({
        ingredients: [
          "formaldehyde", "hydroquinone", "lead acetate", "coal tar", "toluene",
        ],
      })
    );
    expect(r.score).toBe(1);
  });

  it("treats fluoride in toothpaste as a positive, not a hazard", () => {
    const r = scoreCare(
      product({
        name: "Fluoride toothpaste",
        categoriesTags: ["en:toothpastes"],
        ingredients: ["aqua", "hydrated silica", "sodium fluoride", "sorbitol"],
      })
    );
    expect(r.flagged).toHaveLength(0);
    expect(r.positives.some((p) => p.label.includes("Fluoride"))).toBe(true);
    expect(r.score).toBe(10);
  });

  it("only flags SLS in leave-on products, not rinse-off", () => {
    const ingredients = ["aqua", "sodium lauryl sulfate", "glycerin"];
    const shampoo = scoreCare(
      product({ name: "Shampoo", categoriesTags: ["en:shampoos"], ingredients })
    );
    const lotion = scoreCare(
      product({ name: "Body lotion", categoriesTags: ["en:body-lotions"], ingredients })
    );
    expect(shampoo.flagged).toHaveLength(0);
    expect(lotion.flagged.some((f) => f.entryId === "sls")).toBe(true);
  });

  it("downgrades MIT from B to C in rinse-off products", () => {
    const ingredients = ["aqua", "methylisothiazolinone"];
    const shampoo = scoreCare(
      product({ name: "Shampoo", categoriesTags: ["en:shampoos"], ingredients })
    );
    const cream = scoreCare(product({ name: "Face cream", ingredients }));
    expect(shampoo.flagged[0].tier).toBe("C");
    expect(cream.flagged[0].tier).toBe("B");
  });

  it("gives mineral sunscreens the GRASE positive and a high score", () => {
    const r = scoreCare(
      product({
        name: "Mineral sunscreen SPF 30",
        categoriesTags: ["en:sunscreens"],
        ingredients: ["zinc oxide", "aqua", "caprylic/capric triglyceride", "glycerin"],
      })
    );
    expect(r.score).toBe(10);
    expect(r.positives.some((p) => p.label.includes("Mineral"))).toBe(true);
  });

  it("matches benzophenone-3 to oxybenzone (B), not plain benzophenone (A)", () => {
    const r = scoreCare(product({ ingredients: ["benzophenone-3"] }));
    expect(r.flagged[0].entryId).toBe("oxybenzone");
    expect(r.flagged[0].tier).toBe("B");
  });

  it("reports partial confidence when >30% of ingredients are unrecognized", () => {
    const r = scoreCare(
      product({
        ingredients: ["aqua", "xq-polymer 7", "zzz-compound", "mysteryol"],
      })
    );
    expect(r.confidence).toBe("partial");
    expect(r.unknown).toHaveLength(3);
  });

  it("recognizes botanicals and colorants so they don't hurt confidence", () => {
    const r = scoreCare(
      product({
        ingredients: [
          "helianthus annuus seed oil", "butyrospermum parkii butter", "ci 77491", "aloe barbadensis leaf juice",
        ],
      })
    );
    expect(r.unknown).toHaveLength(0);
    expect(r.confidence).toBe("full");
  });
});

describe("splitIngredients", () => {
  it("splits on commas but not inside parentheses", () => {
    expect(
      splitIngredients("Aqua (Water), Parfum (Fragrance), CI 77891 (Titanium Dioxide)")
    ).toEqual(["aqua (water)", "parfum (fragrance)", "ci 77891 (titanium dioxide)"]);
  });

  it("strips an 'Ingredients:' prefix and asterisks", () => {
    expect(splitIngredients("Ingredients: Aqua, Glycerin*")).toEqual(["aqua", "glycerin"]);
  });
});

describe("classifyCare", () => {
  it("detects sunscreen from the product name when tags are missing", () => {
    expect(classifyCare(product({ name: "Hydrating Lotion SPF 30" })).kind).toBe("sunscreen");
  });
  it("defaults unknown products to leave-on (conservative)", () => {
    expect(classifyCare(product({ name: "Mystery balm" })).kind).toBe("leave-on");
  });
});
