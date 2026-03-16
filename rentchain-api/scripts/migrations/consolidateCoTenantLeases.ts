import { FieldPath } from "firebase-admin/firestore";
import {
  FieldValue,
  buildMergedTenantIds,
  db,
  getLeasePrimaryTenantId,
  groupLeaseAgreementCandidates,
  loadCanonicalLeasesByProperty,
  loadFilteredCurrentLeases,
  parseCommonFlags,
  pickAgreementWinner,
  summarizeLease,
  toAgreementCandidates,
  writeReport,
} from "./lib/leaseMigrationSupport";
import { buildMergedLeasePatch } from "../../src/services/leasePartyConsolidationService";

async function main() {
  const flags = parseCommonFlags(process.argv.slice(2));
  const entries = await loadFilteredCurrentLeases(flags);
  const canonicalEntries = await loadCanonicalLeasesByProperty(entries);
  const grouped = groupLeaseAgreementCandidates(toAgreementCandidates(canonicalEntries.map((entry) => ({ lease: entry.lease, raw: entry.raw }))));
  const report = {
    generatedAt: new Date().toISOString(),
    flags,
    groupsFound: grouped.mergeGroups.length,
    groupsMerged: 0,
    winnerLeaseIds: [] as string[],
    loserLeaseIds: [] as string[],
    mergedTenantIdsByWinner: {} as Record<string, string[]>,
    ambiguousGroupsSkipped: grouped.ambiguousGroups.map((group) => ({
      representativeKey: group.representativeKey,
      leaseIds: group.candidates.map((candidate) => candidate.lease.id),
      reasons: group.reasons,
    })),
    errors: [] as Array<{ leaseId?: string; message: string }>,
    groups: [] as any[],
  };

  for (const group of grouped.mergeGroups) {
    if (group.candidates.length < 2) continue;
    const winner = pickAgreementWinner(group.candidates);
    const losers = group.candidates.filter((candidate) => candidate.lease.id !== winner.lease.id);
    const mergedTenantIds = buildMergedTenantIds(group.candidates, winner);
    report.groups.push({
      representativeKey: group.representativeKey,
      winner: summarizeLease(winner.lease, winner.raw),
      losers: losers.map((candidate) => summarizeLease(candidate.lease, candidate.raw)),
      mergedTenantIds,
    });
    report.winnerLeaseIds.push(winner.lease.id);
    report.loserLeaseIds.push(...losers.map((candidate) => candidate.lease.id));
    report.mergedTenantIdsByWinner[winner.lease.id] = mergedTenantIds;

    if (flags.dryRun) continue;

    try {
      const winnerRef = db.collection("leases").doc(winner.lease.id);
      await winnerRef.set(
        {
          ...buildMergedLeasePatch(group.candidates, winner),
          consolidationOccurredAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      for (const loser of losers) {
        const loserRef = db.collection("leases").doc(loser.lease.id);
        if (flags.hardDeleteLosers) {
          await loserRef.delete();
        } else {
          await loserRef.set(
            {
              status: "ended",
              cleanupReason: "merged_into_cotenant_lease",
              cleanedUpAt: FieldValue.serverTimestamp(),
              supersededByLeaseId: winner.lease.id,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        }
      }
      report.groupsMerged += 1;
    } catch (error: any) {
      report.errors.push({ leaseId: winner.lease.id, message: error?.message || String(error) });
    }
  }

  const reportPath = writeReport("consolidateCoTenantLeases.report.json", report);
  console.log(JSON.stringify({
    summary: {
      groupsFound: report.groupsFound,
      groupsMerged: report.groupsMerged,
      winnerLeaseIds: report.winnerLeaseIds.length,
      loserLeaseIds: report.loserLeaseIds.length,
      ambiguousGroupsSkipped: report.ambiguousGroupsSkipped.length,
      errors: report.errors.length,
    },
    reportPath,
  }, null, 2));
}

main().catch((error) => {
  console.error("[consolidateCoTenantLeases] fatal", error);
  process.exitCode = 1;
});
