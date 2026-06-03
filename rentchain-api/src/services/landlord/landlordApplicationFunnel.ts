import { db } from "../../firebase";
import { normalizeApplicationLinkPartialProgress } from "../applicationReminderService";

type LoadLandlordApplicationFunnelParams = {
  landlordId: string;
  propertyId?: string | null;
};

type FunnelStepCount = { step: string; count: number };
type FunnelSectionCount = { section: string; count: number };

export type LandlordApplicationFunnelAnalytics = {
  counts: {
    started: number;
    inProgress: number;
    readyToSubmit: number;
    submitted: number;
    totalStarted: number;
  };
  conversion: {
    completionRate: number;
    averageCompletionPercent: number;
  };
  dropOff: {
    byCurrentStep: FunnelStepCount[];
    byMissingSection: FunnelSectionCount[];
  };
  reminders: {
    remindedCount: number;
    completedAfterReminderCount: number;
    completionRateAfterReminder: number | null;
    medianHoursToCompleteAfterReminder: number | null;
  };
};

function sortCountsDescending<T extends { count: number }>(items: T[]): T[] {
  return items.slice().sort((a, b) => b.count - a.count || String((a as any).step || (a as any).section).localeCompare(String((b as any).step || (b as any).section)));
}

function countMapToList(map: Map<string, number>, key: "step" | "section"): Array<{ [K in typeof key]: string } & { count: number }> {
  return sortCountsDescending(
    Array.from(map.entries())
      .filter(([name, count]) => Boolean(name) && count > 0)
      .map(([name, count]) => ({ [key]: name, count } as any))
  );
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }
  return sorted[middle];
}

async function loadQueryDocs(collectionName: string, landlordId: string, propertyId?: string | null) {
  let query: FirebaseFirestore.Query = db.collection(collectionName).where("landlordId", "==", landlordId);
  if (propertyId) {
    query = query.where("propertyId", "==", propertyId);
  }

  try {
    const snap = await query.get();
    return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  } catch {
    const fallback = await db.collection(collectionName).where("landlordId", "==", landlordId).get();
    return fallback.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
      .filter((doc) => !propertyId || String(doc?.propertyId || "") === propertyId);
  }
}

export async function loadLandlordApplicationFunnel(
  params: LoadLandlordApplicationFunnelParams
): Promise<LandlordApplicationFunnelAnalytics> {
  const landlordId = String(params.landlordId || "").trim();
  const propertyId = String(params.propertyId || "").trim() || null;

  if (!landlordId) {
    return {
      counts: { started: 0, inProgress: 0, readyToSubmit: 0, submitted: 0, totalStarted: 0 },
      conversion: { completionRate: 0, averageCompletionPercent: 0 },
      dropOff: { byCurrentStep: [], byMissingSection: [] },
      reminders: {
        remindedCount: 0,
        completedAfterReminderCount: 0,
        completionRateAfterReminder: null,
        medianHoursToCompleteAfterReminder: null,
      },
    };
  }

  const [links, submittedApplications] = await Promise.all([
    loadQueryDocs("applicationLinks", landlordId, propertyId),
    loadQueryDocs("rentalApplications", landlordId, propertyId),
  ]);

  const activeLinks = links
    .map((link) => ({
      id: link.id,
      partialProgress: normalizeApplicationLinkPartialProgress(link.partialProgress),
    }))
    .filter(
      (link) =>
        link.partialProgress.status === "started" ||
        link.partialProgress.status === "in_progress" ||
        link.partialProgress.status === "ready_to_submit"
    );

  const started = activeLinks.filter((link) => link.partialProgress.status === "started").length;
  const inProgress = activeLinks.filter((link) => link.partialProgress.status === "in_progress").length;
  const readyToSubmit = activeLinks.filter((link) => link.partialProgress.status === "ready_to_submit").length;
  const submitted = submittedApplications.length;
  const totalStarted = started + inProgress + readyToSubmit + submitted;

  const completionSum =
    activeLinks.reduce((sum, link) => sum + link.partialProgress.completionPercent, 0) + submitted * 100;
  const averageCompletionPercent = totalStarted > 0 ? Number((completionSum / totalStarted).toFixed(1)) : 0;
  const completionRate = totalStarted > 0 ? Number((submitted / totalStarted).toFixed(4)) : 0;

  const stepCounts = new Map<string, number>();
  const missingSectionCounts = new Map<string, number>();

  for (const link of activeLinks) {
    if (link.partialProgress.currentStep) {
      stepCounts.set(link.partialProgress.currentStep, (stepCounts.get(link.partialProgress.currentStep) || 0) + 1);
    }
    for (const section of link.partialProgress.missingSections) {
      missingSectionCounts.set(section, (missingSectionCounts.get(section) || 0) + 1);
    }
  }

  const linksById = new Map(
    links.map((link) => [String(link.id), { id: link.id, partialProgress: normalizeApplicationLinkPartialProgress(link.partialProgress) }])
  );
  const remindedLinks = Array.from(linksById.values()).filter((link) => typeof link.partialProgress.reminderSentAt === "number");
  const remindedCount = remindedLinks.length;

  const completionDurationsHours: number[] = [];
  let completedAfterReminderCount = 0;
  for (const application of submittedApplications) {
    const linkId = String(application?.applicationLinkId || "").trim();
    if (!linkId) continue;
    const linked = linksById.get(linkId);
    const reminderSentAt = linked?.partialProgress.reminderSentAt;
    const submittedAt = Number(application?.submittedAt || 0) || null;
    if (typeof reminderSentAt !== "number" || typeof submittedAt !== "number") continue;
    if (submittedAt <= reminderSentAt) continue;
    completedAfterReminderCount += 1;
    completionDurationsHours.push((submittedAt - reminderSentAt) / (60 * 60 * 1000));
  }

  return {
    counts: {
      started,
      inProgress,
      readyToSubmit,
      submitted,
      totalStarted,
    },
    conversion: {
      completionRate,
      averageCompletionPercent,
    },
    dropOff: {
      byCurrentStep: countMapToList(stepCounts, "step"),
      byMissingSection: countMapToList(missingSectionCounts, "section"),
    },
    reminders: {
      remindedCount,
      completedAfterReminderCount,
      completionRateAfterReminder:
        remindedCount > 0 ? Number((completedAfterReminderCount / remindedCount).toFixed(4)) : null,
      medianHoursToCompleteAfterReminder:
        completionDurationsHours.length > 0 ? Number(median(completionDurationsHours)!.toFixed(2)) : null,
    },
  };
}
