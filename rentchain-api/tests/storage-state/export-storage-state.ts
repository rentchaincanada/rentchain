import { writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { getAllStorageStatePresets } from "./storage-state-presets";

/**
 * Export storage state presets to JSON files for use in Playwright tests.
 * Usage: npx tsx rentchain-api/tests/storage-state/export-storage-state.ts [outputDir]
 */
async function exportStorageStates() {
  const outputDir = process.argv[2] || "./.smoke-storage-state";

  try {
    mkdirSync(outputDir, { recursive: true });

    const presets = getAllStorageStatePresets();
    const filePathsWritten: string[] = [];

    for (const preset of presets) {
      const fileName = `${preset.role}-storage-state.json`;
      const filePath = join(outputDir, fileName);

      const content = JSON.stringify(preset.storageState, null, 2);
      writeFileSync(filePath, content, "utf-8");
      filePathsWritten.push(filePath);

      console.log(`✓ Exported ${preset.role} storage state to ${filePath}`);
    }

    // Also write a summary that maps roles to file paths
    const summaryPath = join(outputDir, "storage-state-manifest.json");
    const manifest = Object.fromEntries(
      presets.map((p) => [p.role, `./${p.role}-storage-state.json`])
    );
    writeFileSync(summaryPath, JSON.stringify(manifest, null, 2), "utf-8");
    console.log(`✓ Wrote manifest to ${summaryPath}`);

    // Output environment variable assignments for convenient sourcing
    console.log("\n# Add these to your shell profile or .env.test:");
    for (const preset of presets) {
      const filePath = join(outputDir, `${preset.role}-storage-state.json`);
      const envVar = `QA_${preset.role.toUpperCase()}_STORAGE_STATE`;
      console.log(`export ${envVar}="${filePath}"`);
    }

    process.exit(0);
  } catch (error) {
    console.error("Failed to export storage state:", error);
    process.exit(1);
  }
}

exportStorageStates();
