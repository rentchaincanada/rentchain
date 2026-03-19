import { runTenantScoreBackfill, type TenantScoreBackfillOptions } from "../services/risk/tenantScoreBackfillService";

function readFlag(argv: string[], name: string): string | null {
  const exact = `--${name}`;
  const prefix = `${exact}=`;
  const direct = argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = argv.indexOf(exact);
  if (index >= 0 && argv[index + 1] && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }
  return null;
}

function hasFlag(argv: string[], name: string): boolean {
  return argv.includes(`--${name}`);
}

function parseOptions(argv: string[]): TenantScoreBackfillOptions {
  const recomputeAll = hasFlag(argv, "recompute-all");
  return {
    dryRun: hasFlag(argv, "dry-run"),
    limit: readFlag(argv, "limit") ? Number(readFlag(argv, "limit")) : undefined,
    startAfter: readFlag(argv, "start-after"),
    onlyMissing: recomputeAll ? false : !hasFlag(argv, "only-missing") ? true : true,
    recomputeAll,
    tenantId: readFlag(argv, "tenant-id"),
    propertyId: readFlag(argv, "property-id"),
    landlordId: readFlag(argv, "landlord-id"),
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const summary = await runTenantScoreBackfill(options);
  console.log(`scanned: ${summary.scanned}`);
  console.log(`updated: ${summary.updated}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`errors: ${summary.errors}`);
  if (summary.processedTenantIds.length) {
    console.log(`processedTenantIds: ${summary.processedTenantIds.join(",")}`);
  }
  if (summary.skippedTenantIds.length) {
    console.log(`skippedTenantIds: ${summary.skippedTenantIds.map((entry) => `${entry.tenantId}:${entry.reason}`).join(",")}`);
  }
  if (summary.erroredTenantIds.length) {
    console.log(`erroredTenantIds: ${summary.erroredTenantIds.map((entry) => `${entry.tenantId}:${entry.error}`).join(",")}`);
  }
}

main().catch((error) => {
  console.error("[backfillTenantScore] failed", error);
  process.exitCode = 1;
});
