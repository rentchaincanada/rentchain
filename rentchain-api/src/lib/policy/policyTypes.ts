export type PolicyDomain = "screening" | "maintenance" | "lease_notice" | "application" | "general";

export type PolicyOutcome = "allow" | "block" | "review" | "defer";

export type PolicyReasonSeverity = "info" | "warning" | "blocking";

export type PolicyEvaluationRequest = {
  domain: PolicyDomain;
  action: string;
  actor: {
    role?: string | null;
    userId?: string | null;
  };
  resource: {
    type?: string | null;
    id?: string | null;
  };
  context: Record<string, unknown>;
};

export type PolicyEvaluationResult = {
  version: "v1";
  domain: string;
  action: string;
  outcome: PolicyOutcome;
  reasons: Array<{
    code: string;
    message: string;
    severity?: PolicyReasonSeverity;
  }>;
  matchedRules: Array<{
    ruleId: string;
    ruleName: string;
  }>;
  requiresManualApproval: boolean;
  canAutopilot: boolean;
  evaluatedAt: string;
};

export type PolicyRule = {
  id: string;
  ruleName: string;
  domain: PolicyDomain;
  action: string;
  enabled: boolean;
  priority: number;
  outcome: PolicyOutcome;
  reasonCode: string;
  reasonMessage: string;
  severity?: PolicyReasonSeverity;
  matches: (request: PolicyEvaluationRequest) => boolean;
};

export type AutopilotPolicySummary = {
  outcome: PolicyOutcome;
  canAutopilot: boolean;
  requiresManualApproval: boolean;
  topReasonCode?: string | null;
  topReasonMessage?: string | null;
  evaluatedAt?: string | null;
};
