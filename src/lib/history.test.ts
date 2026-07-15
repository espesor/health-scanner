import { beforeEach, describe, expect, it } from "vitest";
import { addToHistory, loadHistory, type HistoryEntry } from "./history";

// Minimal localStorage for the node test environment (no jsdom needed).
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

function entry(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: "x",
    barcode: "x",
    name: "Product",
    score: 5,
    band: "okay",
    scannedAt: 1000,
    ...over,
  };
}

describe("history", () => {
  beforeEach(() => localStorage.clear());

  it("keeps manual/OCR entries distinct instead of collapsing them", () => {
    // Two products scored without a barcode: same barcode "manual", different ids.
    addToHistory(entry({ id: "manual-1", barcode: "manual", name: "Lotion A", scannedAt: 1 }));
    const after = addToHistory(
      entry({ id: "manual-2", barcode: "manual", name: "Sunscreen B", scannedAt: 2 })
    );
    expect(after).toHaveLength(2);
    expect(after.map((e) => e.name)).toEqual(["Sunscreen B", "Lotion A"]);
  });

  it("de-dupes a re-scan of the same barcode (move-to-front)", () => {
    addToHistory(entry({ id: "111", barcode: "111", name: "Old", scannedAt: 1 }));
    addToHistory(entry({ id: "222", barcode: "222", name: "Other", scannedAt: 2 }));
    const after = addToHistory(entry({ id: "111", barcode: "111", name: "Rescanned", scannedAt: 3 }));
    expect(after).toHaveLength(2);
    expect(after[0].name).toBe("Rescanned");
  });

  it("returns entries newest-first regardless of stored order", () => {
    localStorage.setItem(
      "hs-history-v1",
      JSON.stringify([
        entry({ id: "a", scannedAt: 100 }),
        entry({ id: "b", scannedAt: 300 }),
        entry({ id: "c", scannedAt: 200 }),
      ])
    );
    expect(loadHistory().map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("backfills a missing id from the barcode for legacy entries", () => {
    localStorage.setItem(
      "hs-history-v1",
      JSON.stringify([{ barcode: "999", name: "Legacy", score: 7, band: "good", scannedAt: 5 }])
    );
    expect(loadHistory()[0].id).toBe("999");
  });
});
