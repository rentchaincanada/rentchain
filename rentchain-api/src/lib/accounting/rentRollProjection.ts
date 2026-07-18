import { projectReceivableAging, type ReceivableAgingAllocationPolicy } from "./agingProjection";
import { projectReceivableBalance } from "./balanceProjection";
import { cleanAccountingString, parseDateOnly, sortReceivableFindings, type ReceivableFinding } from "./receivablesTypes";

export type RentRollLeaseStatus = "active" | "signed_future" | "notice_period" | "ended" | "unknown";

export type RentRollLeaseInput = {
  propertyId: string;
  propertyDisplay?: string | null;
  unitId?: string | null;
  unitDisplay?: string | null;
  leaseId: string;
  responsibilityId?: string | null;
  tenantDisplayName?: string | null;
  leaseStatus: RentRollLeaseStatus;
  scheduledRentCents: number;
  currency: "cad";
  nextDueDate?: string | null;
  transactions: readonly unknown[];
};

export type RentRollRow = {
  propertyId: string;
  propertyDisplay: string | null;
  unitId: string | null;
  unitDisplay: string | null;
  leaseId: string;
  responsibilityId: string | null;
  tenantDisplayName: string | null;
  leaseStatus: RentRollLeaseStatus;
  scheduledRentCents: number;
  currency: "cad";
  currentBalanceCents: number;
  outstandingCents: number;
  overpaymentCents: number;
  nextDueDate: string | null;
  aging: {
    currentCents: number;
    days1To30Cents: number;
    days31To60Cents: number;
    days61To90Cents: number;
    days90PlusCents: number;
  };
};

export type RentRollSummary = {
  scheduledRentCents: number;
  currentBalanceCents: number;
  outstandingCents: number;
  overpaymentCents: number;
  leaseCount: number;
};

export type RentRollPropertySummary = RentRollSummary & {
  propertyId: string;
  propertyDisplay: string | null;
};

export type RentRollProjection = {
  asOfDate: string;
  rows: RentRollRow[];
  propertySummaries: RentRollPropertySummary[];
  portfolioSummary: RentRollSummary;
  findings: ReceivableFinding[];
};

const STATUS_SET = new Set<RentRollLeaseStatus>(["active", "signed_future", "notice_period", "ended", "unknown"]);

export function projectRentRoll(input: {
  leases: readonly RentRollLeaseInput[];
  asOfDate: string;
  agingAllocationPolicy?: ReceivableAgingAllocationPolicy;
}): RentRollProjection {
  const findings: ReceivableFinding[] = [];
  const asOf = parseDateOnly(input.asOfDate);
  if (!asOf) findings.push({ code: "invalid_date_only", severity: "error", field: "asOfDate" });
  const rows: RentRollRow[] = [];

  for (const source of input.leases) {
    const leaseId = cleanAccountingString(source.leaseId);
    const propertyId = cleanAccountingString(source.propertyId);
    if (!leaseId) {
      findings.push({ code: "required_field_missing", severity: "error", field: "leaseId" });
      continue;
    }
    if (!propertyId) {
      findings.push({ code: "required_field_missing", severity: "error", field: "propertyId", transactionId: leaseId });
      continue;
    }
    if (!Number.isSafeInteger(source.scheduledRentCents) || source.scheduledRentCents < 0) {
      findings.push({ code: "invalid_scheduled_rent_cents", severity: "error", transactionId: leaseId, field: "scheduledRentCents" });
      continue;
    }
    if (source.currency !== "cad") {
      findings.push({ code: "unsupported_currency", severity: "error", transactionId: leaseId, field: "currency" });
      continue;
    }
    const propertyDisplay = cleanAccountingString(source.propertyDisplay);
    const unitDisplay = cleanAccountingString(source.unitDisplay);
    const tenantDisplayName = cleanAccountingString(source.tenantDisplayName);
    if (!propertyDisplay) findings.push({ code: "property_display_not_provided", severity: "info", transactionId: leaseId });
    if (!unitDisplay) findings.push({ code: "unit_display_not_provided", severity: "info", transactionId: leaseId });
    if (!tenantDisplayName) findings.push({ code: "tenant_display_not_provided", severity: "info", transactionId: leaseId });
    const nextDue = source.nextDueDate ? parseDateOnly(source.nextDueDate) : null;
    if (source.nextDueDate && !nextDue) findings.push({ code: "invalid_date_only", severity: "error", transactionId: leaseId, field: "nextDueDate" });
    const leaseStatus = STATUS_SET.has(source.leaseStatus) ? source.leaseStatus : "unknown";
    if (leaseStatus !== source.leaseStatus) findings.push({ code: "unknown_lease_status", severity: "review", transactionId: leaseId });

    const balance = projectReceivableBalance(source.transactions, { leaseId, propertyId, asOfDate: asOf?.value });
    const aging = projectReceivableAging({
      transactions: source.transactions,
      leaseId,
      propertyId,
      asOfDate: asOf?.value || input.asOfDate,
      allocationPolicy: input.agingAllocationPolicy || "explicit",
    });
    findings.push(...balance.findings, ...aging.findings);
    rows.push({
      propertyId,
      propertyDisplay,
      unitId: cleanAccountingString(source.unitId),
      unitDisplay,
      leaseId,
      responsibilityId: cleanAccountingString(source.responsibilityId),
      tenantDisplayName,
      leaseStatus,
      scheduledRentCents: source.scheduledRentCents,
      currency: "cad",
      currentBalanceCents: balance.netBalanceCents,
      outstandingCents: balance.outstandingCents,
      overpaymentCents: balance.overpaymentCents,
      nextDueDate: nextDue?.value || null,
      aging: {
        currentCents: aging.currentCents,
        days1To30Cents: aging.days1To30Cents,
        days31To60Cents: aging.days31To60Cents,
        days61To90Cents: aging.days61To90Cents,
        days90PlusCents: aging.days90PlusCents,
      },
    });
  }

  rows.sort((a, b) =>
    [a.propertyDisplay || "", a.unitDisplay || "", a.tenantDisplayName || "", a.leaseId]
      .join(":")
      .localeCompare([b.propertyDisplay || "", b.unitDisplay || "", b.tenantDisplayName || "", b.leaseId].join(":"))
  );
  const propertyMap = new Map<string, RentRollPropertySummary>();
  for (const row of rows) {
    const current = propertyMap.get(row.propertyId) || {
      propertyId: row.propertyId,
      propertyDisplay: row.propertyDisplay,
      scheduledRentCents: 0,
      currentBalanceCents: 0,
      outstandingCents: 0,
      overpaymentCents: 0,
      leaseCount: 0,
    };
    current.scheduledRentCents += row.scheduledRentCents;
    current.currentBalanceCents += row.currentBalanceCents;
    current.outstandingCents += row.outstandingCents;
    current.overpaymentCents += row.overpaymentCents;
    current.leaseCount += 1;
    propertyMap.set(row.propertyId, current);
  }
  const propertySummaries = [...propertyMap.values()].sort((a, b) =>
    [a.propertyDisplay || "", a.propertyId].join(":").localeCompare([b.propertyDisplay || "", b.propertyId].join(":"))
  );
  const portfolioSummary = rows.reduce<RentRollSummary>(
    (summary, row) => ({
      scheduledRentCents: summary.scheduledRentCents + row.scheduledRentCents,
      currentBalanceCents: summary.currentBalanceCents + row.currentBalanceCents,
      outstandingCents: summary.outstandingCents + row.outstandingCents,
      overpaymentCents: summary.overpaymentCents + row.overpaymentCents,
      leaseCount: summary.leaseCount + 1,
    }),
    { scheduledRentCents: 0, currentBalanceCents: 0, outstandingCents: 0, overpaymentCents: 0, leaseCount: 0 }
  );
  return {
    asOfDate: asOf?.value || input.asOfDate,
    rows,
    propertySummaries,
    portfolioSummary,
    findings: sortReceivableFindings(findings),
  };
}
