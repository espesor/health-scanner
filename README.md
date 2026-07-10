# Health Scanner

Scan a food product's barcode with your phone and get a 1–10 health score with
an explanation, based on Nutri-Score-style nutrient profiling, NOVA processing
level, additive flags, and snack-vs-meal context. See [DESIGN.md](DESIGN.md)
for the full design; this repo currently implements **M1** (barcode → food
score).

## Run it

```sh
npm install
npm run dev          # desktop dev at http://localhost:5173
npm run dev:phone    # HTTPS dev server for phone testing
npm test             # scoring-engine unit tests
npm run build        # type-check + production build to dist/
```

**On a phone:** run `npm run dev:phone`, then open `https://<your-pc-lan-ip>:5173`
on the phone (same Wi-Fi). Accept the self-signed-certificate warning — the
camera API requires HTTPS. Or type a barcode manually to skip the camera.

## How it works

- **Barcode scanning** uses the native `BarcodeDetector` API when available
  (Android Chrome) and falls back to [zxing-wasm](https://github.com/Sec-ant/zxing-wasm)
  (iOS Safari, desktop). Detected codes are checksum-validated.
- **Product lookup** hits the [Open Food Facts](https://world.openfoodfacts.org)
  API v2 (ODbL-licensed data).
- **Scoring** is a deterministic rubric in [src/lib/food-score.ts](src/lib/food-score.ts)
  — no LLM in the math. See DESIGN.md §5.1.
- Scan history is stored locally (localStorage); nothing leaves the device
  except the barcode lookup.

## Roadmap

M2 personal-care products · M3 label-photo OCR · M4 photo product ID — see
DESIGN.md §9.
