type PaymentReadinessStatus = "not_ready" | "ready_to_configure" | "blocked";
type PaymentReadinessNextAction =
  | "complete_lease_details"
  | "review_rent_terms"
  | "confirm_payment_setup_later"
  | "none";

export type PaymentReadiness = {
  readinessStatus: PaymentReadinessStatus;
  readinessLabel: string;
  readinessDescription: string;
  requiredNextAction: PaymentReadinessNextAction;
  rentTerms: {
    rentAmountAvailable: boolean;
    dueDateAvailable: boolean;
    leaseDatesAvailable: boolean;
    tenantLinked: boolean;
    leaseExecuted: boolean;
  };
  paymentSetup: {
    processorConnected: false;
    moneyMovementEnabled: false;
    storedPaymentMethod: false;
  };
};

type DerivePaymentReadinessInput = {
  leaseId?: string | null;
  monthlyRent?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  dueDay?: number | null;
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  leaseExecution?: {
    executionStatus:
      | "draft"
      | "ready_for_tenant_signature"
      | "tenant_signed"
      | "ready_for_landlord_signature"
      | "landlord_signed"
      | "fully_executed"
      | "blocked";
  } | null;
};

function asString(value: unknown): string | null {
  const next = String(value || "").trim();
  return next || null;
}

function asNumber(value: unknown): number | null {
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

export function derivePaymentReadiness(input: DerivePaymentReadinessInput): PaymentReadiness {
  const leaseId = asString(input.leaseId);
  const monthlyRent = asNumber(input.monthlyRent);
  const dueDay = asNumber(input.dueDay);
  const startDate = asString(input.startDate);
  const endDate = asString(input.endDate);
  const tenantId = asString(input.tenantId);
  const propertyId = asString(input.propertyId);
  const unitId = asString(input.unitId);
  const executionStatus = input.leaseExecution?.executionStatus || null;

  const rentAmountAvailable = typeof monthlyRent === "number" && monthlyRent > 0;
  const dueDateAvailable = typeof dueDay === "number" && dueDay >= 1 && dueDay <= 31;
  const leaseDatesAvailable = Boolean(startDate && (endDate || !endDate));
  const tenantLinked = Boolean(tenantId && propertyId && unitId);
  const leaseExecuted = executionStatus === "fully_executed";

  if (!leaseId || executionStatus === "blocked") {
    return {
      readinessStatus: "blocked",
      readinessLabel: "Lease details needed",
      readinessDescription:
        "This lease record does not expose enough current rent-term detail to describe future payment setup readiness safely.",
      requiredNextAction: "complete_lease_details",
      rentTerms: {
        rentAmountAvailable,
        dueDateAvailable,
        leaseDatesAvailable,
        tenantLinked,
        leaseExecuted,
      },
      paymentSetup: {
        processorConnected: false,
        moneyMovementEnabled: false,
        storedPaymentMethod: false,
      },
    };
  }

  if (rentAmountAvailable && dueDateAvailable && leaseDatesAvailable && tenantLinked) {
    return {
      readinessStatus: "ready_to_configure",
      readinessLabel: "Rent terms ready for future setup",
      readinessDescription:
        "The current lease shows the core rent terms and tenancy linkage needed for a future payment setup workflow, without enabling any payment activity today.",
      requiredNextAction: "confirm_payment_setup_later",
      rentTerms: {
        rentAmountAvailable,
        dueDateAvailable,
        leaseDatesAvailable,
        tenantLinked,
        leaseExecuted,
      },
      paymentSetup: {
        processorConnected: false,
        moneyMovementEnabled: false,
        storedPaymentMethod: false,
      },
    };
  }

  const missingCoreLeaseDetails = !rentAmountAvailable || !leaseDatesAvailable || !tenantLinked;

  return {
    readinessStatus: "not_ready",
    readinessLabel: missingCoreLeaseDetails ? "Lease details needed" : "Review rent terms",
    readinessDescription: missingCoreLeaseDetails
      ? "Some lease details are still missing before this lease can be considered ready for any future payment setup planning."
      : "The lease is visible, but some rent-term details should be reviewed before future payment setup planning.",
    requiredNextAction: missingCoreLeaseDetails ? "complete_lease_details" : "review_rent_terms",
    rentTerms: {
      rentAmountAvailable,
      dueDateAvailable,
      leaseDatesAvailable,
      tenantLinked,
      leaseExecuted,
    },
    paymentSetup: {
      processorConnected: false,
      moneyMovementEnabled: false,
      storedPaymentMethod: false,
    },
  };
}
