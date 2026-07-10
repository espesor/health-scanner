import type { MealContext, Product, ScoreResult } from "../lib/types";
import { BAND_LABEL } from "../lib/food-score";

interface Props {
  product: Product;
  result: ScoreResult;
  onContextChange: (context: MealContext) => void;
  onRescan: () => void;
}

const fmtImpact = (impact: number) =>
  impact === 0 ? "" : `${impact > 0 ? "+" : "−"}${Math.abs(impact).toFixed(1)}`;

export function ScoreCard({ product, result, onContextChange, onRescan }: Props) {
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
          <div className="confidence-badge">low confidence — missing data</div>
        )}
      </div>

      <div className="context-row">
        <span>Scored as a</span>
        <div className="context-toggle" role="group" aria-label="snack or meal">
          {(["snack", "meal"] as MealContext[]).map((c) => (
            <button
              key={c}
              className={result.context === c ? "active" : ""}
              onClick={() => onContextChange(c)}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <section>
        <h3>Why this score</h3>
        <ul className="drivers">
          {result.drivers.map((d) => (
            <li key={d.id} className={d.impact < 0 ? "bad" : d.impact > 0 ? "good" : "info"}>
              <div className="driver-head">
                <strong>{d.label}</strong>
                <span className="impact">{fmtImpact(d.impact)}</span>
              </div>
              <p>{d.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <details className="breakdown">
        <summary>Full metric breakdown</summary>
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Value</th>
              <th>Points</th>
              <th>Source</th>
            </tr>
          </thead>
          <tbody>
            {result.breakdown.map((row, i) => (
              <tr key={i}>
                <td>{row.label}</td>
                <td>{row.value}</td>
                <td>{row.points}</td>
                <td>{row.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="rubric-note">
          Rubric v{result.rubricVersion}. In the points column, + counts against the
          product and − in its favor (Nutri-Score convention); base {result.base}/10
          from raw points {result.raw}, then modifiers apply on the 10-point scale.
        </p>
      </details>

      {product.ingredientsText && (
        <details className="breakdown">
          <summary>Ingredients</summary>
          <p className="ingredients">{product.ingredientsText}</p>
        </details>
      )}

      <button className="primary" onClick={onRescan}>
        Scan another product
      </button>

      <p className="attribution">
        Product data:{" "}
        <a
          href={`https://world.openfoodfacts.org/product/${product.barcode}`}
          target="_blank"
          rel="noreferrer"
        >
          Open Food Facts
        </a>{" "}
        (ODbL)
      </p>
    </div>
  );
}
