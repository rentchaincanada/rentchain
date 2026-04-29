import { isStripeConfigured } from "../stripeService";
import { derivePaymentReadiness, type PaymentReadiness } from "../paymentReadiness/derivePaymentReadiness";
import {
  deriveRentPaymentEligibility,
  getRentPaymentSummaryForLease,
  type RentPaymentSummary,
} from "../rentPayments/rentPaymentService";
import {
  deriveTenantSafeLeaseReadinessMetadata,
  type TenantSafeLeaseReadinessMetadata,
} from "../tenantPortal/tenantProjectionService";
import { asProjectionString } from "./projectionStatusMappings";

type LeasePaymentProjectionLeaseLike = {
  id: string;
  monthlyRent: number | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  unitNumber?: string | null;
  tenantId?: string | null;
  primaryTenantId?: string | null;
  tenantIds?: string[] | null;
  landlordId?: string | null;
};

type BuildLeasePaymentProjectionInput = {
  rawLease: any;
  lease: LeasePaymentProjectionLeaseLike;
  leaseId?: string | null;
  documentUrl?: string | null;
};

export type LeasePaymentProjection = {
  leaseReadiness: TenantSafeLeaseReadinessMetadata;
  paymentReadiness: PaymentReadiness;
  blockedReason:
    | "payment_readiness_not_ready"
    | "lease_not_active"
    | "missing_rent_amount"
    | "missing_tenant_link"
    | "invalid_currency"
    | "stripe_not_configured"
    | null;
  rentPaymentSummary: RentPaymentSummary;
};

export async function buildLeasePaymentProjection(
  input: BuildLeasePaymentProjectionInput
): Promise<LeasePaymentProjection> {
  const leaseId = asProjectionString(input.leaseId) || asProjectionString(input.lease?.id);
  const raw = input.rawLease || {};
  const lease = input.lease;
  const leaseReadiness = deriveTenantSafeLeaseReadinessMetadata(raw, {
    leaseId,
    documentUrl: input.documentUrl ?? null,
  });
  const paymentReadiness = derivePaymentReadiness({
    leaseId,
    monthlyRent: lease.monthlyRent,
    startDate: lease.startDate,
    endDate: lease.endDate,
    dueDay: typeof raw?.dueDay === "number" ? raw.dueDay : null,
    tenantId:
      asProjectionString(lease.tenantId) ||
      asProjectionString(lease.primaryTenantId) ||
      (Array.isArray(lease.tenantIds) ? asProjectionString(lease.tenantIds[0]) : null),
    propertyId: asProjectionString(lease.propertyId),
    unitId: asProjectionString(lease.unitId) || asProjectionString(lease.unitNumber),
    leaseExecution: leaseReadiness.leaseExecution,
  });
  const blockedReason = deriveRentPaymentEligibility({
    lease: {
      id: leaseId || "",
      landlordId: asProjectionString(lease.landlordId),
      tenantId: asProjectionString(lease.tenantId),
      tenantIds: Array.isArray(lease.tenantIds) ? lease.tenantIds : [],
      primaryTenantId: asProjectionString(lease.primaryTenantId),
      propertyId: asProjectionString(lease.propertyId),
      unitId: asProjectionString(lease.unitId),
      unitNumber: asProjectionString(lease.unitNumber),
      monthlyRent: lease.monthlyRent,
      status: lease.status,
    },
    paymentReadiness,
    stripeConfigured: isStripeConfigured(),
  }).blockedReason;
  const rentPaymentSummary = await getRentPaymentSummaryForLease({
    leaseId: leaseId || "",
    paymentRailEnabled: raw?.paymentRailEnabled === true,
    paymentRailEnabledAt: raw?.paymentRailEnabledAt || null,
    paymentRailProcessor: raw?.paymentRailProcessor || null,
    blockedReason,
  });

  return {
    leaseReadiness,
    paymentReadiness,
    blockedReason,
    rentPaymentSummary,
  };
}
