import { db } from "../../config/firebase";

export type TuDailyPoint = { day: string; count: number };
export type TuReferralMetricsPayload = {
  ok: true;
  month: string;
  metrics: {
    referralClicks: number;
    completedScreenings: number;
    activeLandlords: number;
    screeningsPerLandlord: number;
    conversionRate: number;
  };
  dailyInitiated: TuDailyPoint[];
  dailyCompleted: TuDailyPoint[];
};

function parseMonthRange(rawMonth: string | undefined) {
  const now = new Date();
  const fallbackYear = now.getUTCFullYear();
  const fallbackMonth = now.getUTCMonth();
  const value = String(rawMonth || "").trim();

  const match = /^(\d{4})-(\d{2})$/.exec(value);
  const year = match ? Number(match[1]) : fallbackYear;
  const monthIndexRaw = match ? Number(match[2]) - 1 : fallbackMonth;
  const monthIndex = Number.isFinite(monthIndexRaw)
    ? Math.min(Math.max(monthIndexRaw, 0), 11)
    : fallbackMonth;

  const startMs = Date.UTC(year, monthIndex, 1, 0, 0, 0, 0);
  const endMs = Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0);
  const monthKey = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
  return { startMs, endMs, monthKey };
}

function dayKeyUtc(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate()
  ).padStart(2, "0")}`;
}

function bestDay(points: TuDailyPoint[]) {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => b.count - a.count || a.day.localeCompare(b.day));
  return sorted[0];
}

export async function getTuReferralMetricsForMonth(month?: string): Promise<TuReferralMetricsPayload> {
  const { startMs, endMs, monthKey } = parseMonthRange(month);

  const [initiatedSnap, completedSnap] = await Promise.all([
    db
      .collection("screeningReferrals")
      .where("provider", "==", "transunion_referral")
      .where("createdAtMs", ">=", startMs)
      .where("createdAtMs", "<", endMs)
      .get(),
    db
      .collection("screeningReferrals")
      .where("provider", "==", "transunion_referral")
      .where("completedAtMs", ">=", startMs)
      .where("completedAtMs", "<", endMs)
      .get(),
  ]);

  const initiatedDocs = initiatedSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as any) }));
  const completedDocs = completedSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as any) }))
    .filter((doc) => String(doc.status || "").toLowerCase() === "completed");

  const referralClicks = initiatedDocs.length;
  const completedScreenings = completedDocs.length;
  const activeLandlordsSet = new Set<string>();
  const dailyInitiatedMap = new Map<string, number>();
  const dailyCompletedMap = new Map<string, number>();

  for (const doc of initiatedDocs) {
    const landlordHash = String(doc.landlordIdHash || "").trim();
    if (landlordHash) activeLandlordsSet.add(landlordHash);
    const at = Number(doc.createdAtMs || 0);
    if (at > 0) {
      const key = dayKeyUtc(at);
      dailyInitiatedMap.set(key, (dailyInitiatedMap.get(key) || 0) + 1);
    }
  }
  for (const doc of completedDocs) {
    const at = Number(doc.completedAtMs || 0);
    if (at > 0) {
      const key = dayKeyUtc(at);
      dailyCompletedMap.set(key, (dailyCompletedMap.get(key) || 0) + 1);
    }
  }

  const activeLandlords = activeLandlordsSet.size;
  const screeningsPerLandlord =
    activeLandlords > 0 ? Number((completedScreenings / activeLandlords).toFixed(2)) : 0;
  const conversionRate = referralClicks > 0 ? Number((completedScreenings / referralClicks).toFixed(4)) : 0;

  return {
    ok: true,
    month: monthKey,
    metrics: {
      referralClicks,
      completedScreenings,
      activeLandlords,
      screeningsPerLandlord,
      conversionRate,
    },
    dailyInitiated: Array.from(dailyInitiatedMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    dailyCompleted: Array.from(dailyCompletedMap.entries())
      .map(([day, count]) => ({ day, count }))
      .sort((a, b) => a.day.localeCompare(b.day)),
  };
}

export function renderTuReferralReportText(payload: TuReferralMetricsPayload): string {
  const bestInitiated = bestDay(payload.dailyInitiated);
  const bestCompleted = bestDay(payload.dailyCompleted);
  const conversionPct = (payload.metrics.conversionRate * 100).toFixed(2);
  const lines = [
    `TransUnion Referral Metrics Report (${payload.month})`,
    "",
    `Referral clicks: ${payload.metrics.referralClicks}`,
    `Completed screenings: ${payload.metrics.completedScreenings}`,
    `Active landlords: ${payload.metrics.activeLandlords}`,
    `Screenings per landlord: ${payload.metrics.screeningsPerLandlord}`,
    `Conversion rate: ${conversionPct}%`,
    `Daily initiated points: ${payload.dailyInitiated.length}`,
    `Daily completed points: ${payload.dailyCompleted.length}`,
    `Best initiated day: ${bestInitiated ? `${bestInitiated.day} (${bestInitiated.count})` : "n/a"}`,
    `Best completed day: ${bestCompleted ? `${bestCompleted.day} (${bestCompleted.count})` : "n/a"}`,
  ];
  return lines.join("\n");
}

export function renderTuReferralCsv(payload: TuReferralMetricsPayload): string {
  const initiatedMap = new Map(payload.dailyInitiated.map((p) => [p.day, p.count]));
  const completedMap = new Map(payload.dailyCompleted.map((p) => [p.day, p.count]));
  const days = Array.from(new Set([...initiatedMap.keys(), ...completedMap.keys()])).sort();

  const lines: string[] = [];
  lines.push(`month,${payload.month}`);
  lines.push(`referral_clicks,${payload.metrics.referralClicks}`);
  lines.push(`completed_screenings,${payload.metrics.completedScreenings}`);
  lines.push(`active_landlords,${payload.metrics.activeLandlords}`);
  lines.push(`screenings_per_landlord,${payload.metrics.screeningsPerLandlord}`);
  lines.push(`conversion_rate,${payload.metrics.conversionRate}`);
  lines.push("");
  lines.push("day,initiated_count,completed_count");
  for (const day of days) {
    lines.push(`${day},${initiatedMap.get(day) || 0},${completedMap.get(day) || 0}`);
  }
  return lines.join("\n");
}

export function renderTuReferralJson(payload: TuReferralMetricsPayload): string {
  return JSON.stringify(payload, null, 2);
}

