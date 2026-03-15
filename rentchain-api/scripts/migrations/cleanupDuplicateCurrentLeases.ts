import {
  CURRENT_LEASE_STATUSES,
  FieldValue,
  buildDuplicateGroupKey,
  db,
  loadCanonicalLeasesByProperty,
  loadFilteredCurrentLeases,
  parseCommonFlags,
  summarizeLease,
  writeReport,
} from "./lib/leaseMigrationSupport";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    duplicateGroupsFound: 0,
    winnersKept: 0,
    losersEnded: 0,
    losersDeleted: 0,
    ambiguousUnitMatches: 0,
    errors: [] as Array<{ leaseId?: string; message: string }>,
    groups: [] as any[],
  };

  const entries = await loadFilteredCurrentLeases(flags);
  const canonicalEntries = await loadCanonicalLeasesByProperty(entries);
  const groups = new Map<string, typeof canonicalEntries>();
  for (const entry of canonicalEntries) {
    const key = buildDuplicateGroupKey(entry.lease);
    const bucket = groups.get(key) || [];
    bucket.push(entry);
    groups.set(key, bucket);
    if (entry.resolution.ambiguous) report.ambiguousUnitMatches += 1;
  }

  for (const [groupKey, bucket] of groups) {
    if (bucket.length < 2) continue;
    report.duplicateGroupsFound += 1;
    const sorted = [...bucket].sort((a, b) => {
      const rentDiff = Number(b.lease.sourceMonthlyRent > 0) - Number(a.lease.sourceMonthlyRent > 0);
      if (rentDiff !== 0) return rentDiff;
      const startDiff = Number(Boolean(b.lease.leaseStartDate)) - Number(Boolean(a.lease.leaseStartDate));
      if (startDiff !== 0) return startDiff;
      const endDiff = Number(Boolean(b.lease.leaseEndDate)) - Number(Boolean(a.lease.leaseEndDate));
      if (endDiff !== 0) return endDiff;
      const statusOrder = ["renewal_accepted", "move_out_pending", "renewal_pending", "notice_pending", "active"];
      const statusDiff = statusOrder.indexOf(String(a.lease.status || "")) - statusOrder.indexOf(String(b.lease.status || ""));
      if (statusDiff !== 0) return statusDiff;
      const resolvedDiff = Number(b.lease.hasResolvedUnit) - Number(a.lease.hasResolvedUnit);
      if (resolvedDiff !== 0) return resolvedDiff;
      const sourceDiff = b.lease.migrationSourceRank - a.lease.migrationSourceRank;
      if (sourceDiff !== 0) return sourceDiff;
      return Number(a.lease.createdAt || 0) - Number(b.lease.createdAt || 0);
    });

    const winner = sorted[0];
    const losers = sorted.slice(1);
    report.winnersKept += 1;
    report.groups.push({
      groupKey,
      winner: summarizeLease(winner.lease),
      losers: losers.map((entry) => ({
        ...summarizeLease(entry.lease),
        unitResolution: {
          matchedBy: entry.resolution.matchedBy,
          ambiguous: entry.resolution.ambiguous,
          candidateIds: entry.resolution.candidateIds,
        },
      })),
    });

    if (flags.dryRun) continue;

    for (const loser of losers) {
      try {
        const ref = db.collection("leases").doc(loser.lease.id);
        if (flags.hardDelete) {
          await ref.delete();
          report.losersDeleted += 1;
        } else {
          await ref.set(
            {
              status: "ended",
              cleanupReason: "duplicate_current_lease",
              cleanedUpAt: FieldValue.serverTimestamp(),
              supersededByLeaseId: winner.lease.id,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
          report.losersEnded += 1;
        }
      } catch (error: any) {
        report.errors.push({ leaseId: loser.lease.id, message: error?.message || String(error) });
      }
    }
  }

  const reportPath = writeReport("cleanupDuplicateCurrentLeases.report.json", report);
  console.log(JSON.stringify({
    summary: {
      duplicateGroupsFound: report.duplicateGroupsFound,
      winnersKept: report.winnersKept,
      losersEnded: report.losersEnded,
      losersDeleted: report.losersDeleted,
      ambiguousUnitMatches: report.ambiguousUnitMatches,
      errors: report.errors.length,
    },
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error("[cleanupDuplicateCurrentLeases] fatal", error);
  process.exitCode = 1;
});
