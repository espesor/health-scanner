import type { Band, MealContext } from "./types";

export interface HistoryEntry {
  barcode: string;
  name: string;
  brand?: string;
  imageUrl?: string;
  score: number;
  band: Band;
  context: MealContext;
  scannedAt: number;
}

const KEY = "hs-history-v1";
const MAX = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function addToHistory(entry: HistoryEntry): HistoryEntry[] {
  const rest = loadHistory().filter((e) => e.barcode !== entry.barcode);
  const next = [entry, ...rest].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // storage full/blocked — history is best-effort
  }
  return next;
}
