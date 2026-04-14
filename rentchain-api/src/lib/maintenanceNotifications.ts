type ReworkScheduleStatus =
  | "not_scheduled"
  | "scheduled"
  | "contractor_confirmed"
  | "tenant_pending"
  | "confirmed"
  | "reschedule_requested"
  | "cancelled";

type ReworkCycleStatus = "not_started" | "assigned" | "in_progress" | "completed" | "cancelled";

type ReworkReviewStatus = "pending_review" | "landlord_approved" | "tenant_pending_signoff" | "closed" | "follow_up_required";

export type WorkOrderNotifications = {
  landlord: {
    requiresReview: boolean;
    requiresReschedule: boolean;
    lastNotifiedAt: number | null;
  };
  contractor: {
    requiresScheduleConfirmation: boolean;
    requiresExecutionStart: boolean;
    lastNotifiedAt: number | null;
  };
  tenant: {
    requiresAccessConfirmation: boolean;
    requiresSignoff: boolean;
    requiresReworkAwareness: boolean;
    lastNotifiedAt: number | null;
  };
};

function asString(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function anyNotificationActive(section: Record<string, unknown>) {
  return Object.entries(section).some(([key, value]) => key !== "lastNotifiedAt" && value === true);
}

function nextLastNotifiedAt(current: unknown, nextSection: Record<string, unknown>, now: number) {
  const currentSection = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
  const nextActive = anyNotificationActive(nextSection);
  if (!nextActive) return null;
  if (anyNotificationActive(currentSection)) {
    return asNumber(currentSection.lastNotifiedAt) ?? now;
  }
  return now;
}

export function computeWorkOrderNotifications(workOrder: any, now = Date.now()): WorkOrderNotifications {
  const notifications = workOrder?.notifications && typeof workOrder.notifications === "object" ? workOrder.notifications : {};
  const reworkCycle = workOrder?.reworkCycle && typeof workOrder.reworkCycle === "object" ? workOrder.reworkCycle : null;
  const reworkReview = workOrder?.reworkReview && typeof workOrder.reworkReview === "object" ? workOrder.reworkReview : null;
  const schedule = reworkCycle?.schedule && typeof reworkCycle.schedule === "object" ? reworkCycle.schedule : null;

  const reworkCycleStatus = asString(reworkCycle?.status) as ReworkCycleStatus | "";
  const scheduleStatus = asString(schedule?.status) as ReworkScheduleStatus | "";
  const reworkReviewStatus = asString(reworkReview?.status) as ReworkReviewStatus | "";
  const contractorScheduleStatus = asString(schedule?.contractorScheduleStatus);
  const tenantAccessStatus = asString(schedule?.tenantAccessStatus);
  const requiresTenantAccess = schedule?.requiresTenantAccess === true;

  const landlord = {
    requiresReview: reworkReviewStatus === "pending_review" || reworkReviewStatus === "follow_up_required",
    requiresReschedule: scheduleStatus === "reschedule_requested",
    lastNotifiedAt: null as number | null,
  };
  landlord.lastNotifiedAt = nextLastNotifiedAt(notifications?.landlord, landlord, now);

  const contractor = {
    requiresScheduleConfirmation:
      Boolean(reworkCycle) &&
      Boolean(schedule) &&
      contractorScheduleStatus === "pending" &&
      scheduleStatus !== "confirmed" &&
      scheduleStatus !== "cancelled" &&
      scheduleStatus !== "not_scheduled",
    requiresExecutionStart:
      Boolean(reworkCycle) &&
      reworkCycleStatus === "assigned" &&
      (!schedule || scheduleStatus === "confirmed" || scheduleStatus === "not_scheduled"),
    lastNotifiedAt: null as number | null,
  };
  contractor.lastNotifiedAt = nextLastNotifiedAt(notifications?.contractor, contractor, now);

  const tenant = {
    requiresAccessConfirmation: Boolean(reworkCycle) && requiresTenantAccess && tenantAccessStatus === "pending",
    requiresSignoff: reworkReviewStatus === "tenant_pending_signoff",
    requiresReworkAwareness: reworkCycleStatus === "in_progress",
    lastNotifiedAt: null as number | null,
  };
  tenant.lastNotifiedAt = nextLastNotifiedAt(notifications?.tenant, tenant, now);

  return { landlord, contractor, tenant };
}

export function buildTenantSafeWorkOrderNotifications(workOrder: any) {
  const notifications = computeWorkOrderNotifications(workOrder);
  return {
    tenant: {
      requiresAccessConfirmation: notifications.tenant.requiresAccessConfirmation,
      requiresSignoff: notifications.tenant.requiresSignoff,
      requiresReworkAwareness: notifications.tenant.requiresReworkAwareness,
    },
  };
}

export async function applyNotificationUpdate(
  workOrderRef: { set: (data: Record<string, unknown>, opts: { merge: boolean }) => Promise<unknown> },
  workOrder: any,
  now = Date.now()
) {
  const next = computeWorkOrderNotifications(workOrder, now);
  await workOrderRef.set({ notifications: next }, { merge: true });
  return next;
}
