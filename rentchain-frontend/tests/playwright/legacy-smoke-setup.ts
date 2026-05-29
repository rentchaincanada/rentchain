import type { Page } from "@playwright/test";

/**
 * Options for configuring legacy smoke test setup.
 */
export type LegacySmokeSetupOptions = {
  /**
   * Whether to unlock the dev preview gate.
   * When true, sets localStorage["dev_auth_unlocked"] = "1" to bypass the DevAuthGate component.
   * This allows legacy tests to run in dev mode without authentication.
   * @default false
   */
  devPreviewUnlock?: boolean;
};

/**
 * Installs shared setup for legacy frontend smoke tests that need dev preview unlock
 * but don't require full role-based authentication context.
 *
 * This is a simplified alternative to installRoleSmokeHarness for tests that:
 * - Run against frontend-only features without role context
 * - Need to bypass the dev preview gate in development mode
 * - Don't require authenticated API mocking or storage state
 *
 * @example
 * ```ts
 * import { installLegacySmokeHarness } from "./legacy-smoke-setup";
 *
 * test("AI drawer loads", async ({ page }) => {
 *   await installLegacySmokeHarness(page, { devPreviewUnlock: true });
 *   await page.goto("/dashboard");
 *   // Test assertions...
 * });
 * ```
 *
 * @param page - Playwright page instance
 * @param options - Setup configuration options
 */
export async function installLegacySmokeHarness(
  page: Page,
  options: LegacySmokeSetupOptions = {}
): Promise<void> {
  const { devPreviewUnlock = false } = options;

  // Only set up the dev preview unlock if explicitly requested
  if (devPreviewUnlock) {
    await page.addInitScript(() => {
      // Set the localStorage key that DevAuthGate checks to bypass the gate
      // This matches the same key used in role-smoke-helpers.ts for consistency
      window.localStorage.setItem("dev_auth_unlocked", "1");
    });
  }
}
