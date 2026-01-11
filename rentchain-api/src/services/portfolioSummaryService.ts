import { propertyService } from "./propertyService";
import { getTenantsList } from "./tenantDetailsService";
import {
  getLedgerSummaryForTenant,
  listEventsForTenant,
} from "./ledgerEventsService";

export interface PortfolioSnapshot {
  propertyCount: number;
  unitCount: number;
  occupiedUnits: number;
  occupancyPct: number;
  overdueTenants: number;
  totalMonthlyRent: number;
  ledgerAnomalies: string[];
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24);
}

export async function getPortfolioSnapshot(
  landlordId: string
): Promise<PortfolioSnapshot> {
  const properties = propertyService.getAll(landlordId);
  const propertyCount = properties.length;

  const units = properties.flatMap((p) => p.units || []);
  const unitCount = units.length;
  const occupiedUnits = units.filter((u) => u.status === "occupied").length;
  const occupancyPct = unitCount > 0 ? occupiedUnits / unitCount : 0;

  const totalMonthlyRent = units
    .filter((u) => u.status === "occupied")
    .reduce(
      (sum, u) => sum + (typeof (u as any).rent === "number" ? (u as any).rent : 0),
      0
    );

  const tenants = await getTenantsList({ landlordId });
  const ledgerAnomalies: string[] = [];
  let overdueTenants = 0;
  const now = new Date();

  tenants.forEach((t) => {
    const summary = getLedgerSummaryForTenant(t.id);
    const lastPaymentAt = summary.lastPaymentDate
      ? new Date(summary.lastPaymentDate)
      : null;
    const isOverdue =
      summary.currentBalance > 0 &&
      lastPaymentAt &&
      daysBetween(now, lastPaymentAt) > 14;
    if (isOverdue) {
      overdueTenants += 1;
    }

    const events = listEventsForTenant(t.id);
    if (events.length === 0) {
      ledgerAnomalies.push(`Tenant ${t.id}: no payments recorded in system.`);
    } else {
      const lastEvent = events[0];
      if (daysBetween(now, new Date(lastEvent.occurredAt)) > 30) {
        ledgerAnomalies.push(
          `Tenant ${t.id}: no ledger activity in the last 30 days.`
        );
      }
      const recent = events.slice(0, 2);
      if (recent.length === 2) {
        const deltaChange = recent[0].amountDelta - recent[1].amountDelta;
        if (deltaChange > 500) {
          ledgerAnomalies.push(
            `Tenant ${t.id}: sudden balance change detected (+${deltaChange.toFixed(
              0
            )}).`
          );
        }
      }
    }
  });

  return {
    propertyCount,
    unitCount,
    occupiedUnits,
    occupancyPct,
    overdueTenants,
    totalMonthlyRent,
    ledgerAnomalies,
  };
}
