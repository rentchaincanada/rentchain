export type SlaStage =
  | "fresh"
  | "aging"
  | "due_soon"
  | "overdue"
  | "escalated";

export type EscalationLevel =
  | "none"
  | "low"
  | "medium"
  | "high"
  | "critical";

export type SlaEvaluationV1 = {
  version: "v1";
  resource: {
    type: string;
    id: string;
  };
  context: {
    triageCategory?: string | null;
    triageSeverity?: string | null;
    resolutionStatus?: string | null;
    assignmentOwnerId?: string | null;
    assignmentOwnerLabel?: string | null;
  };
  age: {
    firstSeenAt?: string | null;
    lastSeenAt?: string | null;
    ageMs: number;
    ageHours: number;
  };
  sla: {
    stage: SlaStage;
    escalationLevel: EscalationLevel;
    thresholdHours: {
      aging: number;
      dueSoon: number;
      overdue: number;
      escalated: number;
    };
  };
  reason: {
    code: string;
    summary: string;
    details?: string | null;
  };
  evaluatedAt: string;
};
