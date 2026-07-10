import type { BeautyProduct, CareScoreResult, HazardTier } from "../lib/types";
import { BAND_LABEL } from "../lib/food-score";

interface Props {
  product: BeautyProduct;
  result: CareScoreResult;
  onRescan: () => void;
}

const TIER_NAME: Record<HazardTier, string> = {
  A: "Serious",
  B: "Significant concern",
  C: "Mild concern",
};

export function CareScoreCard({ product, result, onRescan }: Props) {
  return (
    <div className="score-card">
      <header className="product-header">
        {product.imageUrl && <img src={product.imageUrl} alt="" />}
        <div>
          <h2>{product.name}</h2>
          {product.brand && <p className="brand">{product.brand}</p>}
          <p className="barcode-label">EAN {product.barcode}</p>
        </div>
      </header>

      <div className={`score-hero band-${result.band}`}>
        <div className="score-number">
          {result.score}
          <span className="score-max">/10</span>
        </div>
        <div className="score-band">{BAND_LABEL[result.band]}</div>
        {result.confidence === "partial" && (
          <div className="confidence-badge">
            low confidence — {result.unknown.length} of {result.totalIngredients} ingredients not evaluated
          </div>
        )}
      </div>

      <div className="context-row">
        <span>Personal care ·</span>
        <span className="kind-chip">{result.kindLabel}</span>
      </div>

      <section>
        <h3>Why this score</h3>
        {result.flagged.length === 0 && (
          <p className="clean-note">
            No ingredients of concern found among the {result.totalIngredients} listed.
          </p>
        )}
        <ul className="drivers">
          {result.flagged.map((f) => (
            <li key={f.entryId} className={`bad tier-${f.tier}`}>
              <div className="driver-head">
                <strong>{f.ingredient}</strong>
                <span className="impact">−{Math.abs(f.impact).toFixed(1)}</span>
              </div>
              <p>
                <span className={`tier-badge tier-${f.tier}`}>{TIER_NAME[f.tier]}</span>{" "}
                {f.reason} <em>({f.source})</em>
              </p>
            </li>
          ))}
          {result.positives.map((p) => (
            <li key={p.label} className="good">
              <div className="driver-head">
                <strong>{p.label}</strong>
              </div>
              <p>
                {p.detail} <em>({p.source})</em>
              </p>
            </li>
          ))}
        </ul>
      </section>

      {result.notes.map((note) => (
        <p key={note} className="care-note">
          {note}
        </p>
      ))}

      {result.unknown.length > 0 && (
        <details className="breakdown">
          <summary>Not evaluated ({result.unknown.length})</summary>
          <p className="ingredients">
            These ingredients aren't in the hazard database (v1) and carry no
            penalty: {result.unknown.join(", ")}
          </p>
        </details>
      )}

      {product.ingredientsText && (
        <details className="breakdown">
          <summary>Ingredients (full label)</summary>
          <p className="ingredients">{product.ingredientsText}</p>
        </details>
      )}

      <button className="primary" onClick={onRescan}>
        Scan another product
      </button>

      <p className="attribution">
        Product data:{" "}
        <a
          href={`https://world.openbeautyfacts.org/product/${product.barcode}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Beauty Facts
        </a>{" "}
        (ODbL) · Rubric v{result.rubricVersion}
      </p>
    </div>
  );
}
