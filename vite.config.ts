import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { VitePWA } from "vite-plugin-pwa";

// `npm run dev:phone` (--mode phone) serves over self-signed HTTPS so the
// camera works when the app is opened from a phone on the same LAN.
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === "phone" ? [basicSsl()] : []),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Health Scanner",
        short_name: "HealthScan",
        description: "Scan a product barcode and get a 1-10 health score",
        theme_color: "#10151c",
        background_color: "#10151c",
        display: "standalone",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      }
    })
  ],
  server: { host: true, port: 5173 }
}));
