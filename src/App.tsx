import { useCallback, useState } from "react";
import { Scanner } from "./components/Scanner";
import { ScoreCard } from "./components/ScoreCard";
import { isValidEan } from "./lib/barcode";
import { scoreFood } from "./lib/food-score";
import { addToHistory, loadHistory, type HistoryEntry } from "./lib/history";
import { fetchProduct, inferContext } from "./lib/openfoodfacts";
import type { MealContext, Product, ScoreResult } from "./lib/types";

type Screen =
  | { kind: "scan" }
  | { kind: "loading"; barcode: string }
  | { kind: "result"; product: Product; result: ScoreResult }
  | { kind: "notfound"; barcode: string }
  | { kind: "error"; message: string };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ kind: "scan" });
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);
  const [manual, setManual] = useState("");

  const analyze = useCallback(async (barcode: string) => {
    if (navigator.vibrate) navigator.vibrate(80);
    setScreen({ kind: "loading", barcode });
    try {
      const product = await fetchProduct(barcode);
      if (!product) {
        setScreen({ kind: "notfound", barcode });
        return;
      }
      const context = inferContext(product);
      const result = scoreFood(product, context);
      setScreen({ kind: "result", product, result });
      setHistory(
        addToHistory({
          barcode: product.barcode,
          name: product.name,
          brand: product.brand,
          imageUrl: product.imageUrl,
          score: result.score,
          band: result.band,
          context,
          scannedAt: Date.now(),
        })
      );
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

          {history.length > 0 && (
            <section className="history">
              <h3>Recent scans</h3>
              <ul>
                {history.map((h) => (
                  <li key={h.barcode}>
                    <button onClick={() => analyze(h.barcode)}>
                      {h.imageUrl ? <img src={h.imageUrl} alt="" /> : <span className="thumb-placeholder" />}
                      <span className="history-name">
                        {h.name}
                        {h.brand ? <small> · {h.brand}</small> : null}
                      </span>
                      <span className={`history-score band-${h.band}`}>{h.score}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
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
        <div className="status">
          <h2>Product not found</h2>
          <p>
            Barcode <strong>{screen.barcode}</strong> isn't in Open Food Facts yet.
            Label-photo analysis is coming in M3.
          </p>
          <button className="primary" onClick={() => setScreen({ kind: "scan" })}>
            Scan again
          </button>
        </div>
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
