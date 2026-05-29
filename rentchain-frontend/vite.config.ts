import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const isTdzDebug = mode === "tdzdebug";

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: isTdzDebug ? "prompt" : "autoUpdate",
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        manifestFilename: "manifest.webmanifest",
        includeAssets: [
          "icons/icon-192-light.png",
          "icons/icon-512-light.png",
        ],
        manifest: {
          name: "RentChain",
          short_name: "RentChain",
          start_url: "/",
          display: "standalone",
          background_color: "#ffffff",
          theme_color: "#0b1220",
          icons: [
            {
              src: "/icons/icon-192-light.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "/icons/icon-512-light.png",
              sizes: "512x512",
              type: "image/png",
            },
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
      dedupe: ["react", "react-dom"],
      alias: {
        "@": path.resolve(__dirname, "src"),
        react: path.resolve(__dirname, "node_modules/react"),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      },
    },

    server: {
      host: "0.0.0.0",
      port: 5173,
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
      sourcemap: isTdzDebug,
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("/node_modules/firebase/")) {
              return "firebase-vendor";
            }

            if (
              id.includes("react") ||
              id.includes("react-dom") ||
              id.includes("react-router-dom")
            ) {
              return "react-vendor";
            }

            if (id.includes("/node_modules/recharts/")) {
              return "charts-vendor";
            }

            return "vendor";
          },
        },
      },
    },

    test: {
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      include: ["src/**/*.{test,spec}.{ts,tsx}", "tests/smoke/**/*.{test,spec}.{ts,tsx}"],
      exclude: ["tests/playwright/**", "node_modules/**", "dist/**"],

      // ✅ stable + memory controlled
      pool: "forks",
      maxWorkers: 2,
      watch: false,

    },
  };
});
