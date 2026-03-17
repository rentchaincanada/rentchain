import { runLeaseRiskBackfill, type LeaseRiskBackfillOptions } from "../services/risk/leaseRiskBackfillService";

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

function parseOptions(argv: string[]): LeaseRiskBackfillOptions {
  const recomputeAll = hasFlag(argv, "recompute-all");
  return {
    dryRun: hasFlag(argv, "dry-run"),
    limit: readFlag(argv, "limit") ? Number(readFlag(argv, "limit")) : undefined,
    startAfter: readFlag(argv, "start-after"),
    onlyMissing: recomputeAll ? false : !hasFlag(argv, "only-missing") ? true : true,
    recomputeAll,
    propertyId: readFlag(argv, "property-id"),
    landlordId: readFlag(argv, "landlord-id"),
    leaseId: readFlag(argv, "lease-id"),
  };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const summary = await runLeaseRiskBackfill(options);
  console.log(`scanned: ${summary.scanned}`);
  console.log(`updated: ${summary.updated}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`errors: ${summary.errors}`);
  if (summary.processedLeaseIds.length) {
    console.log(`processedLeaseIds: ${summary.processedLeaseIds.join(",")}`);
  }
  if (summary.skippedLeaseIds.length) {
    console.log(`skippedLeaseIds: ${summary.skippedLeaseIds.map((entry) => `${entry.leaseId}:${entry.reason}`).join(",")}`);
  }
  if (summary.erroredLeaseIds.length) {
    console.log(`erroredLeaseIds: ${summary.erroredLeaseIds.map((entry) => `${entry.leaseId}:${entry.error}`).join(",")}`);
  }
}

main().catch((error) => {
  console.error("[backfillLeaseRisk] failed", error);
  process.exitCode = 1;
});
