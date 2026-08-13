import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: false },

      includeAssets: [
        "favicon.png",
        "appletouchicon.png",
        "icons/icon192.png",
        "icons/icon512.png",
        "icons/icon512-maskable.png",
      ],

      manifest: {
        name: "ANIMIS - Animal Management Information System",
        short_name: "ANIMIS",
        description:
          "Animal Health, Breeding, Disease Surveillance, and Inventory Management System",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        icons: [
          { src: "/icons/icon192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/icons/icon512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      // ✅ FIX: allow >2MiB files in precache
      workbox: {
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024, // 6 MiB
      },
    }),
  ],
});