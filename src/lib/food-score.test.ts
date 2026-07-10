import { describe, expect, it } from "vitest";
import { isValidEan } from "./barcode";
import { scoreFood } from "./food-score";
import type { Product } from "./types";

const base: Omit<Product, "nutriments"> = {
  barcode: "0000000000000",
  name: "Test product",
  categoriesTags: [],
  additivesTags: [],
};

describe("scoreFood", () => {
  it("scores a sugary ultra-processed cookie as Avoid when eaten as a snack", () => {
    const cookie: Product = {
      ...base,
      novaGroup: 4,
      servingSizeG: 34,
      nutriments: {
        energyKj: 2000,
        energyKcal: 478,
        sugars: 38,
        saturatedFat: 9,
        salt: 0.6,
        fiber: 2,
        proteins: 5,
      },
    };
    const r = scoreFood(cookie, "snack");
    expect(r.score).toBeLessThanOrEqual(2);
    expect(r.band).toBe("avoid");
    expect(r.modifiers.some((m) => m.id === "nova4")).toBe(true);
    expect(r.modifiers.some((m) => m.id === "serv-sugar")).toBe(true);
  });

  it("scores plain nonfat greek yogurt as excellent", () => {
    const yogurt: Product = {
      ...base,
      novaGroup: 1,
      nutriments: {
        energyKj: 247,
        energyKcal: 59,
        sugars: 3.2,
        saturatedFat: 0.1,
        salt: 0.09,
        fiber: 0,
        proteins: 10,
      },
    };
    const r = scoreFood(yogurt, "snack");
    expect(r.score).toBeGreaterThanOrEqual(8.5);
    expect(r.band).toBe("excellent");
  });

  it("weighs sugar harder for snacks than for meals", () => {
    const sweet: Product = {
      ...base,
      nutriments: {
        energyKj: 1500,
        sugars: 25,
        saturatedFat: 2,
        salt: 0.3,
        proteins: 4,
        fiber: 1,
      },
    };
    const asSnack = scoreFood(sweet, "snack");
    const asMeal = scoreFood(sweet, "meal");
    expect(asSnack.score).toBeLessThan(asMeal.score);
  });

  it("withholds the protein credit when negative points are high", () => {
    const candyBar: Product = {
      ...base,
      nutriments: {
        energyKj: 2100,
        sugars: 45,
        saturatedFat: 8,
        salt: 0.5,
        proteins: 20,
      },
    };
    const r = scoreFood(candyBar, "snack");
    expect(r.breakdown.find((row) => row.label === "Protein")?.points).toBe("not counted");
  });

  it("flags additives of concern and caps the penalty at -1.5", () => {
    const dyed: Product = {
      ...base,
      additivesTags: ["en:e102", "en:e110", "en:e129", "en:e171"],
      nutriments: { energyKj: 500, sugars: 5, saturatedFat: 1, salt: 0.2 },
    };
    const r = scoreFood(dyed, "snack");
    const additives = r.modifiers.find((m) => m.id === "additives");
    expect(additives?.impact).toBe(-1.5);
  });

  it("reports partial confidence when key nutrients are missing", () => {
    const sparse: Product = { ...base, nutriments: { proteins: 5 } };
    const r = scoreFood(sparse, "meal");
    expect(r.confidence).toBe("partial");
    expect(r.missing.length).toBeGreaterThanOrEqual(2);
  });
});

describe("isValidEan", () => {
  it("accepts real EAN-13 codes", () => {
    expect(isValidEan("3017620422003")).toBe(true); // Nutella
    expect(isValidEan("5000159407236")).toBe(true); // Snickers
  });
  it("rejects checksum failures and junk", () => {
    expect(isValidEan("3017620422004")).toBe(false);
    expect(isValidEan("1234")).toBe(false);
    expect(isValidEan("abcdefghijklm")).toBe(false);
  });
});
