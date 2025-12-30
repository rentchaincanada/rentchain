import { LedgerEventV2 } from "./ledgerEventsFirestoreService";

export type TenantRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TenantSignals {
  tenantId: string;
  landlordId: string;
  riskLevel: TenantRiskLevel;
  latePaymentsCount: number;
  nsfCount: number;
  missedPaymentsCount: number;
  evictionNoticeCount: number;
  positiveNotesCount: number;
  lastEventAt: number | null;
  computedAt: number;
}

function textify(ev: LedgerEventV2) {
  return `${ev.title || ""} ${ev.summary || ""}`.toLowerCase();
}

export function computeRiskLevel(signals: TenantSignals): TenantRiskLevel {
  if (
    signals.evictionNoticeCount >= 1 ||
    signals.nsfCount >= 2 ||
    signals.missedPaymentsCount >= 2
  ) {
    return "HIGH";
  }
  if (
    signals.latePaymentsCount >= 2 ||
    signals.nsfCount === 1 ||
    signals.missedPaymentsCount === 1
  ) {
    return "MEDIUM";
  }
  return "LOW";
}

export function computeTenantSignals(events: LedgerEventV2[], tenantId: string, landlordId: string): TenantSignals {
  let latePaymentsCount = 0;
  let nsfCount = 0;
  let missedPaymentsCount = 0;
  let evictionNoticeCount = 0;
  let positiveNotesCount = 0;
  let lastEventAt: number | null = null;

  for (const ev of events) {
    const t = textify(ev);
    const tags = (ev.tags || []).map((x) => String(x || "").toLowerCase());
    if (t.includes("nsf") || t.includes("returned payment")) nsfCount += 1;
    if (t.includes("missed") || t.includes("unpaid")) missedPaymentsCount += 1;
    if ((t.includes("notice") && t.includes("evict")) || t.includes("eviction")) evictionNoticeCount += 1;
    if (t.includes("good tenant") || t.includes("paid early") || t.includes("excellent")) positiveNotesCount += 1;
    if (tags.includes("late") || ev.eventType === "STATUS_CHANGED" && t.includes("late") || t.includes("late")) {
      latePaymentsCount += 1;
    }
    if (typeof ev.occurredAt === "number") {
      if (lastEventAt === null || ev.occurredAt > lastEventAt) lastEventAt = ev.occurredAt;
    }
  }

  const base: TenantSignals = {
    tenantId,
    landlordId,
    latePaymentsCount,
    nsfCount,
    missedPaymentsCount,
    evictionNoticeCount,
    positiveNotesCount,
    lastEventAt,
    riskLevel: "LOW",
    computedAt: Date.now(),
  };

  return { ...base, riskLevel: computeRiskLevel(base) };
}
