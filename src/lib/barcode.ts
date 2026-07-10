/**
 * Barcode detection: native BarcodeDetector where available (Android Chrome),
 * zxing-wasm fallback elsewhere (iOS Safari, desktop).
 */

export interface Detector {
  engine: "native" | "wasm";
  /** Returns a checksum-valid EAN/UPC from the current video frame, or null. */
  detect(video: HTMLVideoElement): Promise<string | null>;
}

interface NativeBarcodeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: {
      new (options?: { formats: string[] }): NativeBarcodeDetector;
      getSupportedFormats(): Promise<string[]>;
    };
  }
}

/** EAN-8 / UPC-A / EAN-13 checksum (mod-10, weights 3/1 from the right). */
export function isValidEan(code: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

function firstValid(codes: string[]): string | null {
  for (const c of codes) if (isValidEan(c)) return c;
  return null;
}

async function createNative(): Promise<Detector | null> {
  if (!window.BarcodeDetector) return null;
  try {
    const supported = await window.BarcodeDetector.getSupportedFormats();
    const formats = ["ean_13", "ean_8", "upc_a", "upc_e"].filter((f) =>
      supported.includes(f)
    );
    if (!formats.includes("ean_13")) return null;
    const det = new window.BarcodeDetector({ formats });
    return {
      engine: "native",
      async detect(video) {
        if (video.readyState < 2) return null;
        const hits = await det.detect(video);
        return firstValid(hits.map((h) => h.rawValue));
      },
    };
  } catch {
    return null;
  }
}

async function createWasm(): Promise<Detector> {
  const { readBarcodes, prepareZXingModule } = await import("zxing-wasm/reader");
  const wasmUrl = (await import("zxing-wasm/reader/zxing_reader.wasm?url")).default;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? wasmUrl : prefix + path,
    },
  } as never);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;

  return {
    engine: "wasm",
    async detect(video) {
      if (video.readyState < 2 || video.videoWidth === 0) return null;
      const scale = Math.min(1, 800 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hits = await readBarcodes(imageData, {
        formats: ["EAN-13", "EAN-8", "UPC-A", "UPC-E"],
        tryHarder: true,
        maxNumberOfSymbols: 1,
      });
      return firstValid(hits.filter((h) => h.isValid).map((h) => h.text));
    },
  };
}

let detectorPromise: Promise<Detector> | null = null;

export function createDetector(): Promise<Detector> {
  detectorPromise ??= (async () => (await createNative()) ?? createWasm())();
  return detectorPromise;
}
