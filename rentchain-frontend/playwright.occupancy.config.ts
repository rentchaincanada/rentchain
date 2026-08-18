import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

const localBaseUrl = "http://localhost:4179";

export default defineConfig({
  ...baseConfig,
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: "VITE_API_BASE_URL=https://local-api.rentchain.test npm run build:app && npm run preview -- --host --port 4179",
        url: localBaseUrl,
        reuseExistingServer: false,
        timeout: 120_000,
      },
  use: {
    ...baseConfig.use,
    baseURL: process.env.BASE_URL || localBaseUrl,
  },
});
