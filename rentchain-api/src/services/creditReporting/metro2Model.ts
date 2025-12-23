import { CreditPeriod } from "../tenantCreditProfileService";

export interface Metro2LikeRecord {
  tenantRef: string;
  landlordRef: string;
  accountRef: string | null;
  period: string; // YYYY-MM
  amountDue: number | null;
  amountPaid: number;
  daysLate: number | null;
  statusCode: string;
  asOfDate: string;
}

export function mapStatusToCode(status: CreditPeriod["status"]): string {
  switch (status) {
    case "on_time":
      return "OK";
    case "late_1_29":
      return "30";
    case "late_30_59":
      return "60";
    case "late_60_plus":
      return "90";
    case "partial":
      return "PARTIAL";
    case "unpaid":
      return "UNPAID";
    default:
      return "NO_DATA";
  }
}

export function toMetro2LikeRecords(options: {
  tenantId: string;
  landlordId: string;
  leaseId?: string | null;
  periods: CreditPeriod[];
}): Metro2LikeRecord[] {
  const { tenantId, landlordId, leaseId, periods } = options;
  return periods.map((p) => ({
    tenantRef: tenantId,
    landlordRef: landlordId,
    accountRef: leaseId ?? null,
    period: p.period,
    amountDue: p.rentAmount ?? null,
    amountPaid: p.amountPaid ?? 0,
    daysLate: p.daysLate ?? null,
    statusCode: mapStatusToCode(p.status),
    asOfDate: p.dueDate ?? p.period,
  }));
}
