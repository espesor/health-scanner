import { useCallback, useState } from "react";
import { CareScoreCard } from "./components/CareScoreCard";
import { LabelCapture } from "./components/LabelCapture";
import { ManualCareForm, buildCareProduct } from "./components/ManualCareForm";
import { HistoryList } from "./components/HistoryList";
import { Scanner } from "./components/Scanner";
import { ScoreCard } from "./components/ScoreCard";
import { isValidEan } from "./lib/barcode";
import { scoreCare } from "./lib/care-score";
import { scoreFood } from "./lib/food-score";
import {
  addToHistory,
  clearHistory,
  loadHistory,
  removeFromHistory,
  type HistoryEntry,
} from "./lib/history";
import { fetchBeautyProduct } from "./lib/openbeautyfacts";
import { fetchProduct, inferContext } from "./lib/openfoodfacts";
import { disposeOcr } from "./lib/ocr";
import type {
  BeautyProduct,
  CareScoreResult,
  MealContext,
  Product,
  ScoreResult,
} from "./lib/types";

type Screen =
  | { kind: "scan" }
  | { kind: "loading"; barcode: string }
  | { kind: "result"; product: Product; result: ScoreResult }
  | { kind: "care-result"; product: BeautyProduct; result: CareScoreResult }
  | { kind: "nodata"; product: BeautyProduct }
  | { kind: "notfound"; barcode: string }
  | { kind: "ocr" }
  | { kind: "care-form"; ingredients: string }
  | { kind: "error"; message: string };

function hasNutrition(p: Product): boolean {
  const n = p.nutriments;
  return [n.energyKj, n.sugars, n.saturatedFat, n.salt].some((v) => v !== undefined);
}

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "scan" });
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [manual, setManual] = useState("");

  const analyze = useCallback(async (barcode: string) => {
    if (navigator.vibrate) navigator.vibrate(80);
    setScreen({ kind: "loading", barcode });
    try {
      // A barcode could be either database; query both and route by best data.
      const [offRes, obfRes] = await Promise.allSettled([
        fetchProduct(barcode),
        fetchBeautyProduct(barcode),
      ]);
      const food = offRes.status === "fulfilled" ? offRes.value : null;
      const care = obfRes.status === "fulfilled" ? obfRes.value : null;
      if (offRes.status === "rejected" && obfRes.status === "rejected") throw offRes.reason;

      if (food && hasNutrition(food)) {
        const context = inferContext(food);
        const result = scoreFood(food, context);
        setScreen({ kind: "result", product: food, result });
        setHistory(
          addToHistory({
            id: food.barcode,
            type: "food",
            barcode: food.barcode,
            name: food.name,
            brand: food.brand,
            imageUrl: food.imageUrl,
            score: result.score,
            band: result.band,
            context,
            scannedAt: Date.now(),
          })
        );
        return;
      }

      if (care) {
        if (!care.ingredients.length && !care.ingredientsText) {
          setScreen({ kind: "nodata", product: care });
          return;
        }
        const result = scoreCare(care);
        setScreen({ kind: "care-result", product: care, result });
        setHistory(
          addToHistory({
            id: care.barcode,
            type: "care",
            barcode: care.barcode,
            name: care.name,
            brand: care.brand,
            imageUrl: care.imageUrl,
            score: result.score,
            band: result.band,
            scannedAt: Date.now(),
          })
        );
        return;
      }

      if (food) {
        // In Open Food Facts but without nutrition data — score what we can.
        const context = inferContext(food);
        const result = scoreFood(food, context);
        setScreen({ kind: "result", product: food, result });
        return;
      }

      setScreen({ kind: "notfound", barcode });
    } catch (e) {
      setScreen({
        kind: "error",
        message: e instanceof Error ? e.message : "Lookup failed",
      });
    }
  }, []);

  const changeContext = (context: MealContext) => {
    if (screen.kind !== "result") return;
    setScreen({
      kind: "result",
      product: screen.product,
      result: scoreFood(screen.product, context),
    });
  };

  // Called only from ManualCareForm (paste + OCR), so these are always local
  // entries with no database record — store the ingredients so they can be
  // re-opened by re-scoring locally, under a unique id so they don't collide.
  const onCareScored = useCallback(
    (product: BeautyProduct, result: CareScoreResult) => {
      setScreen({ kind: "care-result", product, result });
      const scannedAt = Date.now();
      setHistory(
        addToHistory({
          id: `manual-${scannedAt}`,
          type: "care",
          barcode: product.barcode,
          name: product.name,
          score: result.score,
          band: result.band,
          careKind: result.kind,
          ingredientsText: product.ingredientsText,
          scannedAt,
        })
      );
    },
    []
  );

  // Re-open a recent scan: manual/OCR care entries are re-scored locally from
  // their saved ingredients; database entries are re-fetched by barcode.
  const openHistory = useCallback(
    (h: HistoryEntry) => {
      if (h.careKind && h.ingredientsText) {
        const product = buildCareProduct({
          barcode: h.barcode,
          name: h.name,
          kind: h.careKind,
          ingredientsText: h.ingredientsText,
        });
        setScreen({ kind: "care-result", product, result: scoreCare(product) });
        return;
      }
      analyze(h.barcode);
    },
    [analyze]
  );

  const deleteHistory = useCallback((id: string) => {
    setHistory(removeFromHistory(id));
  }, []);

  const clearAllHistory = useCallback(() => {
    setHistory(clearHistory());
  }, []);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const code = manual.trim();
    if (!isValidEan(code)) {
      setScreen({ kind: "error", message: `"${code}" is not a valid EAN/UPC barcode.` });
      return;
    }
    setManual("");
    analyze(code);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Health Scanner</h1>
        <p>Scan a product · get a 1–10 health score</p>
      </header>

      {screen.kind === "scan" && (
        <>
          <Scanner onDetected={analyze} paused={false} />
          <form className="manual-entry" onSubmit={submitManual}>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="…or type a barcode (e.g. 3017620422003)"
              aria-label="barcode"
            />
            <button type="submit" className="primary">
              Analyze
            </button>
          </form>
          <button
            className="link-button"
            onClick={() => setScreen({ kind: "ocr" })}
          >
            No barcode? Photograph the ingredients label →
          </button>

          {history.length > 0 && (
            <HistoryList
              entries={history}
              onOpen={openHistory}
              onDelete={deleteHistory}
              onClearAll={clearAllHistory}
            />
          )}
        </>
      )}

      {screen.kind === "loading" && (
        <div className="status">
          <div className="spinner" />
          <p>Looking up {screen.barcode}…</p>
        </div>
      )}

      {screen.kind === "notfound" && (
        <div className="notfound-screen">
          <div className="status">
            <h2>Product not found</h2>
            <p>
              Barcode <strong>{screen.barcode}</strong> isn't in Open Food Facts or
              Open Beauty Facts. US products often have limited coverage — read the
              label instead.
            </p>
            <div className="notfound-actions">
              <button className="primary" onClick={() => setScreen({ kind: "ocr" })}>
                Photograph the label
              </button>
              <button className="secondary" onClick={() => setScreen({ kind: "scan" })}>
                Scan again
              </button>
            </div>
          </div>
          <div className="manual-care-card">
            <p className="manual-care-title">…or paste the ingredients</p>
            <ManualCareForm barcode={screen.barcode} onScored={onCareScored} />
          </div>
        </div>
      )}

      {screen.kind === "ocr" && (
        <LabelCapture
          onExtracted={(ingredients) => setScreen({ kind: "care-form", ingredients })}
          onCancel={() => {
            disposeOcr();
            setScreen({ kind: "scan" });
          }}
        />
      )}

      {screen.kind === "care-form" && (
        <div className="notfound-screen">
          <div className="manual-care-card">
            <p className="manual-care-title">Check the ingredients, then analyze</p>
            <ManualCareForm
              initialIngredients={screen.ingredients}
              hint={
                screen.ingredients
                  ? "Read from your photo — fix any OCR mistakes before scoring."
                  : "Nothing legible was found. Type or paste the ingredients."
              }
              onScored={onCareScored}
            />
            <button
              className="link-button"
              onClick={() => setScreen({ kind: "ocr" })}
            >
              ← Retake photo
            </button>
          </div>
        </div>
      )}

      {screen.kind === "nodata" && (
        <div className="status">
          <h2>No ingredient list available</h2>
          <p>
            <strong>{screen.product.name}</strong> is in Open Beauty Facts, but
            without an ingredient list there's nothing to evaluate. Photograph
            the label to score it.
          </p>
          <div className="notfound-actions">
            <button className="primary" onClick={() => setScreen({ kind: "ocr" })}>
              Photograph the label
            </button>
            <button className="secondary" onClick={() => setScreen({ kind: "scan" })}>
              Scan again
            </button>
          </div>
        </div>
      )}

      {screen.kind === "care-result" && (
        <CareScoreCard
          product={screen.product}
          result={screen.result}
          onRescan={() => setScreen({ kind: "scan" })}
        />
      )}

      {screen.kind === "error" && (
        <div className="status">
          <h2>Something went wrong</h2>
          <p>{screen.message}</p>
          <button className="primary" onClick={() => setScreen({ kind: "scan" })}>
            Back to scanner
          </button>
        </div>
      )}

      {screen.kind === "result" && (
        <ScoreCard
          product={screen.product}
          result={screen.result}
          onContextChange={changeContext}
          onRescan={() => setScreen({ kind: "scan" })}
        />
      )}

      <footer className="disclaimer">
        Informational only — not medical or nutrition advice. Scores reflect
        published dietary guidelines, not individual health needs. Always read
        the physical label, especially for allergens.
      </footer>
    </div>
  );
}
