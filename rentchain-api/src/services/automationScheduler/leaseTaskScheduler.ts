import crypto from "crypto";

export type LeaseAutomationTaskKind =
  | "renewal_reminder"
  | "rent_increase_eligibility_check"
  | "renewal_offer_draft"
  | "move_out_reminder_30"
  | "move_out_reminder_14"
  | "move_out_reminder_3";

export type LeaseAutomationTaskMode = "draft" | "reminder";

export type LeaseAutomationTask = {
  id: string;
  leaseId: string;
  kind: LeaseAutomationTaskKind;
  mode: LeaseAutomationTaskMode;
  dueDate: string;
  reason: string;
  status: "upcoming";
  createdAt: string;
};

type LeaseLike = {
  id: string;
  startDate?: string | null;
  endDate?: string | null;
  automationEnabled?: boolean;
  renewalStatus?: "unknown" | "offered" | "accepted" | "declined" | string;
};

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(input: string): Date | null {
  const raw = String(input || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function minusDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() - days);
  return next;
}

function makeTask(input: {
  leaseId: string;
  kind: LeaseAutomationTaskKind;
  mode: LeaseAutomationTaskMode;
  dueDate: string;
  reason: string;
  createdAt: string;
}): LeaseAutomationTask {
  const digest = crypto
    .createHash("sha1")
    .update(
      `${input.leaseId}:${input.kind}:${input.mode}:${input.dueDate}:${input.reason}`
    )
    .digest("hex")
    .slice(0, 12);
  return {
    id: `lat_${digest}`,
    leaseId: input.leaseId,
    kind: input.kind,
    mode: input.mode,
    dueDate: input.dueDate,
    reason: input.reason,
    status: "upcoming",
    createdAt: input.createdAt,
  };
}

export function generateLeaseAutomationTasks(lease: LeaseLike): LeaseAutomationTask[] {
  if (!lease || !lease.id) return [];
  if (lease.automationEnabled === false) return [];

  const endDate = parseDateOnly(String(lease.endDate || ""));
  if (!endDate) return [];

  const createdAt = new Date().toISOString();
  const tasks: LeaseAutomationTask[] = [
    makeTask({
      leaseId: lease.id,
      kind: "renewal_reminder",
      mode: "reminder",
      dueDate: toDateOnly(minusDays(endDate, 90)),
      reason: "T-90 renewal reminder",
      createdAt,
    }),
    makeTask({
      leaseId: lease.id,
      kind: "rent_increase_eligibility_check",
      mode: "draft",
      dueDate: toDateOnly(minusDays(endDate, 75)),
      reason: "T-75 rent increase eligibility check draft",
      createdAt,
    }),
    makeTask({
      leaseId: lease.id,
      kind: "renewal_offer_draft",
      mode: "draft",
      dueDate: toDateOnly(minusDays(endDate, 60)),
      reason: "T-60 renewal offer draft",
      createdAt,
    }),
  ];

  const renewalStatus = String(lease.renewalStatus || "unknown").toLowerCase();
  if (renewalStatus === "declined") {
    tasks.push(
      makeTask({
        leaseId: lease.id,
        kind: "move_out_reminder_30",
        mode: "reminder",
        dueDate: toDateOnly(minusDays(endDate, 30)),
        reason: "T-30 move-out reminder",
        createdAt,
      }),
      makeTask({
        leaseId: lease.id,
        kind: "move_out_reminder_14",
        mode: "reminder",
        dueDate: toDateOnly(minusDays(endDate, 14)),
        reason: "T-14 move-out reminder",
        createdAt,
      }),
      makeTask({
        leaseId: lease.id,
        kind: "move_out_reminder_3",
        mode: "reminder",
        dueDate: toDateOnly(minusDays(endDate, 3)),
        reason: "T-3 move-out reminder",
        createdAt,
      })
    );
  }

  return tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
