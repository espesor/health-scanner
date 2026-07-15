import type { Band, CareKind, MealContext } from "./types";

export interface HistoryEntry {
  /**
   * Stable de-dup key. For database scans this is the barcode; for manual/OCR
   * care entries it's a synthetic `manual-<timestamp>` so multiple products
   * scored without a barcode don't overwrite each other.
   */
  id: string;
  /** absent in entries saved before M2 — those are food */
  type?: "food" | "care";
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  score: number;
  band: Band;
  /** food only */
  context?: MealContext;
  /**
   * Present only for manual/OCR care entries. Lets us re-open them by
   * re-scoring locally (scoreCare) instead of a doomed barcode lookup.
   */
  careKind?: CareKind;
  ingredientsText?: string;
  scannedAt: number;
}

const KEY = "hs-history-v1";
const MAX = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const entries = raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    return (
      entries
        // Backfill id for entries saved before ids existed.
        .map((e) => ({ ...e, id: e.id ?? e.barcode }))
        // Always present newest first, regardless of stored order.
        .sort((a, b) => (b.scannedAt ?? 0) - (a.scannedAt ?? 0))
    );
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): HistoryEntry[] {
  const rest = loadHistory().filter((e) => e.id !== entry.id);
  const next = [entry, ...rest]
    .sort((a, b) => (b.scannedAt ?? 0) - (a.scannedAt ?? 0))
    .slice(0, MAX);
  return persist(next);
}

/** Remove a single entry by id. */
export function removeFromHistory(id: string): HistoryEntry[] {
  return persist(loadHistory().filter((e) => e.id !== id));
}

/** Remove every entry. */
export function clearHistory(): HistoryEntry[] {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // storage blocked — best-effort
  }
  return [];
}

function persist(entries: HistoryEntry[]): HistoryEntry[] {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // storage full/blocked — history is best-effort
  }
  return entries;
}
