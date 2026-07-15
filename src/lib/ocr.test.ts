import { describe, expect, it } from "vitest";
import { extractIngredients } from "./ocr";

describe("extractIngredients", () => {
  it("starts after an 'Ingredients:' heading and drops what comes before", () => {
    const raw = "Net Wt 3 oz\nIngredients: Aqua, Glycerin, Parfum";
    expect(extractIngredients(raw)).toBe("Aqua, Glycerin, Parfum");
  });

  it("trims a trailing 'Directions' section", () => {
    const raw = "Ingredients: Aqua, Glycerin. Directions: Apply liberally.";
    expect(extractIngredients(raw)).toBe("Aqua, Glycerin");
  });

  it("trims a trailing 'Warnings' section", () => {
    const raw =
      "Ingredients: Zinc Oxide, Water, Coconut Oil Warnings: For external use only.";
    expect(extractIngredients(raw)).toBe("Zinc Oxide, Water, Coconut Oil");
  });

  it("collapses OCR line breaks into a single line", () => {
    const raw = "Ingredients:\nAqua,\nGlycerin,\nSodium\nFluoride";
    expect(extractIngredients(raw)).toBe("Aqua, Glycerin, Sodium Fluoride");
  });

  it("returns the cleaned text unchanged when there is no heading", () => {
    expect(extractIngredients("Aqua, Glycerin, Parfum")).toBe("Aqua, Glycerin, Parfum");
  });

  it("squeezes doubled commas from OCR gaps and a dangling separator", () => {
    expect(extractIngredients("Aqua,, Glycerin ,")).toBe("Aqua, Glycerin");
  });
});
