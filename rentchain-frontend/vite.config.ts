import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifestFilename: "manifest.webmanifest",
      includeAssets: ["icons/icon-192-light.png", "icons/icon-512-light.png"],
      manifest: {
        name: "RentChain",
        short_name: "RentChain",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#0b1220",
        icons: [
          { src: "/icons/icon-192-light.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512-light.png", sizes: "512x512", type: "image/png" },
        ],
      },
      workbox: {
        navigateFallbackDenylist: [/^\/templates\//, /^\/sample\//],
        runtimeCaching: [
          {
            urlPattern: /\/templates\/.*\.(pdf|docx|csv)(\?.*)?$/,
            handler: "NetworkOnly",
            options: { cacheName: "templates" },
          },
          {
            urlPattern: /\/sample\/.*\.pdf(\?.*)?$/,
            handler: "NetworkOnly",
            options: { cacheName: "samples" },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    // Allow any host in dev so ngrok/mobile work
    allowedHosts: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("react")) return "react";
            return "vendor";
          }
        },
      },
    },
  },
});
