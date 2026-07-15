/**
 * Client-side OCR for ingredient labels using Tesseract.js (WASM). The captured
 * image never leaves the device — the engine and English model are the only
 * things fetched (once, from the jsDelivr CDN), then recognition runs locally.
 *
 * Classical OCR struggles with curved, glossy labels, so the extracted text is
 * always handed to a confirm-and-correct editor before scoring (DESIGN.md M3).
 */
import { createWorker, type Worker } from "tesseract.js";

export type OcrProgress = (fraction: number, status: string) => void;

let workerPromise: Promise<Worker> | null = null;

function getWorker(onProgress?: OcrProgress): Promise<Worker> {
  workerPromise ??= createWorker("eng", 1, {
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") onProgress?.(m.progress, "reading label");
    },
  });
  return workerPromise;
}

/** Run OCR over an image (File/Blob/data URL/canvas) and return the raw text. */
export async function recognizeText(
  image: File | Blob | string | HTMLCanvasElement,
  onProgress?: OcrProgress
): Promise<string> {
  onProgress?.(0, "starting engine");
  const worker = await getWorker(onProgress);
  const { data } = await worker.recognize(image);
  return data.text ?? "";
}

// Section headers that commonly follow the ingredient list on a label; we cut
// the OCR text at the first one so directions/warnings don't pollute scoring.
const TRAILING_SECTIONS =
  /\b(directions?|warnings?|caution|precautions?|other information|uses?|indications?|net\s?wt|distributed by|manufactured (for|by)|made in|questions|comments|storage|keep out of reach|for external use)\b/i;

/**
 * Pull the ingredient list out of raw OCR text. Starts after an "Ingredients:"
 * heading when present, and trims trailing label sections. Best-effort — the
 * result is always shown in an editable field, so imperfect cuts are fine.
 */
export function extractIngredients(raw: string): string {
  // Collapse line breaks and OCR whitespace noise into single spaces.
  let text = raw.replace(/\s*\n\s*/g, " ").replace(/[ \t]+/g, " ").trim();

  const heading = text.match(/ingredient(?:s|es)?\b\s*[:.\-]?\s*/i);
  if (heading) {
    text = text.slice(heading.index! + heading[0].length);
  }

  const trailing = text.match(TRAILING_SECTIONS);
  if (trailing && trailing.index! > 0) {
    text = text.slice(0, trailing.index);
  }

  // Tidy: collapse runs of commas from OCR gaps, squeeze doubled spaces, and
  // drop any dangling separator or period at the end.
  return text
    .replace(/\s*,(\s*,)+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/[;,.\s]+$/, "")
    .trim();
}

/** Free the OCR worker (e.g. when leaving the capture screen for a while). */
export async function disposeOcr(): Promise<void> {
  if (!workerPromise) return;
  const worker = await workerPromise;
  workerPromise = null;
  await worker.terminate();
}
