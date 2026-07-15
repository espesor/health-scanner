# Health Scanner

Scan a food product's barcode with your phone and get a 1–10 health score with
an explanation, based on Nutri-Score-style nutrient profiling, NOVA processing
level, additive flags, and snack-vs-meal context. See [DESIGN.md](DESIGN.md)
for the full design; this repo currently implements **M1** (barcode → food
score), **M2** (personal-care products: sunscreen, toothpaste, lotion…), and
**M3** (on-device label OCR when a barcode isn't in the databases).

**Live app:** https://espesor.github.io/health-scanner/ — open it on your
phone and point the camera at a barcode. Deployed automatically from `main`
by [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

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
- **Product lookup** queries [Open Food Facts](https://world.openfoodfacts.org)
  and [Open Beauty Facts](https://world.openbeautyfacts.org) (ODbL-licensed
  data) in parallel and routes to the food or personal-care rubric.
- **Label OCR fallback** — when a barcode isn't in either database (common for
  US products), photograph the ingredients panel. [Tesseract.js](https://github.com/naptha/tesseract.js)
  reads it entirely on-device (the image never leaves the phone); the extracted
  text lands in an editable box for correction, then runs the care rubric.
- **Scoring** is deterministic — no LLM in the math. Food:
  [src/lib/food-score.ts](src/lib/food-score.ts) (DESIGN.md §5.1). Personal
  care: [src/lib/care-score.ts](src/lib/care-score.ts) against the curated
  hazard database in [src/lib/hazard-db.ts](src/lib/hazard-db.ts), compiled
  from EU CosIng Annex II/III, FDA monographs, IARC, and Prop 65 (§5.2).
- Scan history is stored locally (localStorage); nothing leaves the device
  except the barcode lookup.

## Roadmap

M4 photo product ID · M5 polish — see DESIGN.md §9.
