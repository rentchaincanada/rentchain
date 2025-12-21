import { arr, num, str } from "@/utils/safe";
import type { TenantView } from "@/types/tenantView";

export function toTenantView(raw: any): TenantView {
  const tenant = raw?.tenant ?? raw ?? {};
  const lease = raw?.lease ?? tenant?.lease ?? {};
  const balance = raw?.balance ?? tenant?.balance ?? {};
  const ledgerSummary = raw?.ledgerSummary ?? raw?.summary ?? tenant?.ledgerSummary ?? {};

  const paymentsRaw = raw?.payments ?? tenant?.payments ?? raw?.paymentHistory ?? [];
  const payments = arr<any>(paymentsRaw).map((p) => ({
    id: str(p?.id, cryptoRandomIdFallback(p)),
    tenantId: str(tenant?.id, "unknown"),
    amount: num(p?.amount),
    paidAt: p?.paidAt ? str(p.paidAt) : undefined,
    method: p?.method ? str(p.method) : undefined,
    notes: p?.notes ?? null,
  }));

  const name =
    str(tenant?.fullName, "") ||
    str(tenant?.name, "") ||
    str(tenant?.legalName, "") ||
    "Tenant";

  return {
    id: str(tenant?.id, "unknown"),
    name,
    legalName: tenant?.legalName ? str(tenant.legalName) : undefined,
    email: tenant?.email ? str(tenant.email) : undefined,
    phone: tenant?.phone ? str(tenant.phone) : undefined,
    propertyId: tenant?.propertyId ? str(tenant.propertyId) : undefined,
    propertyName: tenant?.propertyName ? str(tenant.propertyName) : undefined,
    unit: tenant?.unit ? str(tenant.unit) : lease?.unitNumber ? str(lease.unitNumber) : undefined,
    leaseStart: lease?.startDate ? str(lease.startDate) : undefined,
    leaseEnd: lease?.endDate ? str(lease.endDate) : undefined,
    status: tenant?.status ? str(tenant.status) : undefined,
    riskLevel: tenant?.riskLevel ? str(tenant.riskLevel) : undefined,

    lease: {
      monthlyRent: num(lease?.monthlyRent ?? lease?.rent ?? lease?.rentAmount),
      unitLabel: lease?.unitLabel
        ? str(lease.unitLabel)
        : lease?.unitNumber
        ? str(lease.unitNumber)
        : undefined,
      startDate: lease?.startDate ? str(lease.startDate) : undefined,
      endDate: lease?.endDate ? str(lease.endDate) : undefined,
    },

    balance: {
      current: num(balance?.current ?? balance?.currentBalance),
      pastDue: num(balance?.pastDue ?? balance?.overdue ?? balance?.pastDueBalance),
    },

    ledgerSummary: {
      lastPaymentAmount:
        ledgerSummary?.lastPaymentAmount != null
          ? num(ledgerSummary.lastPaymentAmount)
          : undefined,
      lastPaymentDate: ledgerSummary?.lastPaymentDate ? str(ledgerSummary.lastPaymentDate) : undefined,
      totalPaidThisYear:
        ledgerSummary?.totalPaidThisYear != null ? num(ledgerSummary.totalPaidThisYear) : undefined,
      ledgerEventCount: ledgerSummary?.ledgerEventCount != null ? num(ledgerSummary.ledgerEventCount) : undefined,
    },

    payments,
  };
}

function cryptoRandomIdFallback(p: any) {
  return str(p?.paidAt, "") + "-" + String(p?.amount ?? "");
}
