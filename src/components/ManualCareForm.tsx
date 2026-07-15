import { useState } from "react";
import { scoreCare } from "../lib/care-score";
import type { BeautyProduct, CareKind, CareScoreResult } from "../lib/types";

const KIND_TAGS: Record<CareKind, string> = {
  "leave-on": "en:body-lotions",
  "rinse-off": "en:shower-gels",
  sunscreen: "en:sunscreens",
  oral: "en:toothpastes",
};

interface Props {
  barcode?: string;
  initialName?: string;
  initialKind?: CareKind;
  initialIngredients?: string;
  /** Shown above the ingredients box, e.g. to say the text came from OCR. */
  hint?: string;
  onScored: (product: BeautyProduct, result: CareScoreResult) => void;
}

/**
 * Editable "analyze by ingredients" form. Backs both the barcode-not-found
 * paste fallback and the M3 OCR confirm-and-correct step — in both cases the
 * user can fix the text before scoring.
 */
export function ManualCareForm({
  barcode,
  initialName = "",
  initialKind = "leave-on",
  initialIngredients = "",
  hint,
  onScored,
}: Props) {
  const [name, setName] = useState(initialName);
  const [kind, setKind] = useState<CareKind>(initialKind);
  const [ingredients, setIngredients] = useState(initialIngredients);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ingredients.trim()) return;
    const product: BeautyProduct = {
      barcode: barcode ?? "manual",
      name: name.trim() || "Manual entry",
      categoriesTags: [KIND_TAGS[kind]],
      ingredients: [],
      ingredientsText: ingredients.trim(),
    };
    onScored(product, scoreCare(product));
  };

  return (
    <form className="manual-care-form" onSubmit={submit}>
      <input
        type="text"
        className="manual-care-input"
        placeholder="Product name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className="manual-care-input"
        value={kind}
        onChange={(e) => setKind(e.target.value as CareKind)}
      >
        <option value="leave-on">Leave-on — lotion, cream, serum</option>
        <option value="rinse-off">Rinse-off — shampoo, body wash, cleanser</option>
        <option value="sunscreen">Sunscreen — SPF product</option>
        <option value="oral">Oral care — toothpaste, mouthwash</option>
      </select>
      {hint && <p className="manual-care-hint">{hint}</p>}
      <textarea
        className="manual-care-textarea"
        placeholder="Paste ingredients here, e.g.: Aqua, Glycerin, Cetearyl Alcohol, Dimethicone..."
        value={ingredients}
        onChange={(e) => setIngredients(e.target.value)}
        rows={6}
      />
      <button type="submit" className="primary" disabled={!ingredients.trim()}>
        Analyze ingredients
      </button>
    </form>
  );
}
