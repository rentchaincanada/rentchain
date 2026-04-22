import { beforeEach, describe, expect, it, vi } from "vitest";

const loadLandlordAnalyticsSnapshot = vi.fn();
const saveReviewedLandlordDecisionState = vi.fn();
const saveSnoozedLandlordDecisionState = vi.fn();
const saveDismissedLandlordDecisionState = vi.fn();
const saveExecutedLandlordDecisionState = vi.fn();
const saveFailedLandlordDecisionExecutionOutcome = vi.fn();
const writeCanonicalEvent = vi.fn();
const executeAutomation = vi.fn();
const buildLeaseNoticePolicyRequest = vi.fn();
const evaluatePolicy = vi.fn();
const toAutopilotPolicySummary = vi.fn();
const writePolicyEvaluatedEvent = vi.fn();
const buildLeaseNoticePreviewInputFromLease = vi.fn();
const getLeaseForLandlordWorkflow = vi.fn();
const normalizeLeaseRecord = vi.fn();
const performLeaseNoticeSendFromPreviewInput = vi.fn();

vi.mock("../../middleware/requireAuth", () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (!req.user) return res.status(401).json({ ok: false, error: "UNAUTHORIZED" });
    return next();
  },
}));

vi.mock("../../middleware/requireLandlord", () => ({
  requireLandlord: (req: any, res: any, next: any) => {
    const role = String(req.user?.role || "").trim().toLowerCase();
    const landlordId = req.user?.landlordId || req.user?.id;
    if (role !== "landlord" && role !== "admin") {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }
    if (!landlordId) {
      return res.status(401).json({ ok: false, error: "Missing landlord context" });
    }
    req.user.landlordId = landlordId;
    return next();
  },
}));

vi.mock("../../services/landlord/landlordAnalyticsSnapshot", () => ({
  loadLandlordAnalyticsSnapshot,
}));

vi.mock("../../services/landlord/landlordDecisionStates", () => ({
  saveReviewedLandlordDecisionState,
  saveSnoozedLandlordDecisionState,
  saveDismissedLandlordDecisionState,
  saveExecutedLandlordDecisionState,
  saveFailedLandlordDecisionExecutionOutcome,
}));

vi.mock("../../lib/automation/automationExecutor", () => ({
  executeAutomation,
}));

vi.mock("../../lib/policy/policyAdapters", () => ({
  buildLeaseNoticePolicyRequest,
}));

vi.mock("../../lib/policy/policyEvaluator", () => ({
  evaluatePolicy,
  toAutopilotPolicySummary,
  writePolicyEvaluatedEvent,
}));

vi.mock("../../services/leaseNoticeWorkflowService", () => ({
  buildLeaseNoticePreviewInputFromLease,
  getLeaseForLandlordWorkflow,
  normalizeLeaseRecord,
  performLeaseNoticeSendFromPreviewInput,
}));

vi.mock("../../lib/events/buildEvent", () => ({
  writeCanonicalEvent,
}));

async function invokeRouter(
  router: any,
  options: { method: string; url: string; user?: Record<string, unknown> | null; body?: any }
) {
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const [path, queryString] = options.url.split("?");
    const query = new URLSearchParams(queryString || "");
    const req: any = {
      method: options.method,
      url: options.url,
      originalUrl: options.url,
      path,
      user: options.user ?? null,
      body: options.body ?? {},
      query: Object.fromEntries(query.entries()),
      params: {},
      headers: {},
      get(name: string) {
        return this.headers[String(name).toLowerCase()];
      },
      header(name: string) {
        return this.get(name);
      },
    };
    const decisionMatch = path.match(/\/landlord\/analytics\/decisions\/([^/]+)\/(review|snooze|dismiss|execute)$/);
    if (decisionMatch) {
      req.params.decisionId = decodeURIComponent(decisionMatch[1]);
    }

    const res: any = {
      statusCode: 200,
      headers: {} as Record<string, string>,
      setHeader(name: string, value: string) {
        this.headers[name.toLowerCase()] = value;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
      send(payload: any) {
        resolve({ status: this.statusCode, body: payload });
        return this;
      },
    };
    router.handle(req, res, (error: any) => {
      if (error) reject(error);
    });
  });
}

describe("landlordAnalyticsRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveReviewedLandlordDecisionState.mockResolvedValue({
      id: "landlord-1__reduce_vacancy_risk:prop-123",
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
      state: "reviewed",
      reviewedAt: "2026-04-20T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    saveSnoozedLandlordDecisionState.mockResolvedValue({
      id: "landlord-1__reduce_vacancy_risk:prop-123",
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
      state: "snoozed",
      snoozedAt: "2026-04-20T12:00:00.000Z",
      snoozedUntil: "2026-04-23T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    saveDismissedLandlordDecisionState.mockResolvedValue({
      id: "landlord-1__reduce_vacancy_risk:prop-123",
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
      state: "dismissed",
      dismissedAt: "2026-04-20T12:00:00.000Z",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    saveExecutedLandlordDecisionState.mockResolvedValue({
      id: "landlord-1__review_lease_renewals:prop-1",
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      state: "executed",
      reviewedAt: null,
      executedAt: "2026-04-20T12:00:00.000Z",
      executionOutcomeStatus: "succeeded",
      executionOutcomeAt: "2026-04-20T12:00:00.000Z",
      executionOutcomeReason: null,
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    saveFailedLandlordDecisionExecutionOutcome.mockResolvedValue({
      id: "landlord-1__review_lease_renewals:prop-1",
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      state: "pending",
      reviewedAt: null,
      executedAt: null,
      executionOutcomeStatus: "failed",
      executionOutcomeAt: "2026-04-20T12:00:00.000Z",
      executionOutcomeReason: "AUTOMATION_EXECUTION_FAILED",
      createdAt: "2026-04-20T12:00:00.000Z",
      updatedAt: "2026-04-20T12:00:00.000Z",
    });
    writeCanonicalEvent.mockResolvedValue(undefined);
    buildLeaseNoticePreviewInputFromLease.mockReturnValue({
      rentChangeMode: "no_change",
      proposedRent: null,
      newTermType: "fixed_term",
      newLeaseStartDate: "2026-05-11",
      newLeaseEndDate: "2027-05-10",
      responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
      noticeType: "renewal_offer",
    });
    getLeaseForLandlordWorkflow.mockResolvedValue({
      ok: true,
      lease: {
        id: "lease-1",
        landlordId: "landlord-1",
        tenantId: "tenant-1",
        propertyId: "prop-1",
        unitId: "unit-1",
        province: "NS",
        leaseType: "fixed_term",
        latestNoticeId: null,
      },
    });
    normalizeLeaseRecord.mockImplementation((_id: string, raw: any) => ({ ...raw }));
    buildLeaseNoticePolicyRequest.mockReturnValue({
      domain: "lease_notice",
      action: "send_notice",
      context: { hasRequiredLegalInputs: true },
    });
    evaluatePolicy.mockReturnValue({ outcome: "allow", requiresManualApproval: false });
    toAutopilotPolicySummary.mockReturnValue({ outcome: "allow", canAutopilot: true });
    writePolicyEvaluatedEvent.mockResolvedValue(undefined);
    performLeaseNoticeSendFromPreviewInput.mockResolvedValue({
      status: 201,
      payload: {
        ok: true,
        noticeId: "notice-1",
        autopilotPolicy: { outcome: "allow", canAutopilot: true },
      },
    });
    executeAutomation.mockImplementation(async (input: any) => {
      const data = await input.context.execute();
      return {
        automationResult: {
          action: input.action,
          executed: true,
          skipped: false,
          timestamp: "2026-04-20T12:00:00.000Z",
        },
        data,
      };
    });
    loadLandlordAnalyticsSnapshot.mockResolvedValue({
      summary: {
        occupiedUnits: 4,
        vacancyRate: 0.2,
        activeApplications: 2,
        applicationConversionRate: 0.25,
        openWorkOrders: 1,
        maintenanceCostCents: 8200,
        estimatedScheduledRentCents: 660000,
        leasesEndingSoon: 1,
      },
      applications: {
        started: 3,
        submitted: 2,
        approved: 1,
        rejected: 0,
        declined: 0,
        pendingReviewCount: 2,
        conversionRate: 0.5,
      },
      leasing: {
        totalProperties: 2,
        totalUnits: 5,
        occupiedUnits: 4,
        vacantUnits: 1,
        occupancyRate: 0.8,
        leasesEndingIn30Days: 1,
        leasesEndingIn60Days: 1,
        leasesEndingIn90Days: 1,
        turnoverCount: 0,
      },
      maintenance: {
        openWorkOrders: 1,
        completedWorkOrders: 1,
        reopenedWorkOrders: 0,
        maintenanceCostCents: 8200,
        averageCostPerCompletedWorkOrderCents: 8200,
        costConcentrationByProperty: [],
      },
      revenue: {
        estimatedScheduledRentCents: 660000,
        averageRentPerOccupiedUnitCents: 165000,
      },
      decisions: {
        items: [
          {
            id: "reduce_vacancy_risk:prop-123",
            decisionType: "reduce_vacancy_risk",
            priority: "medium",
            explanation: "Vacancy pressure is present in the current view, so leasing attention should stay active.",
            supportingSignals: [{ source: "predictive_metric", key: "projected_vacancy_risk", label: "Projected vacancy risk" }],
            recommendedAction: "Reduce vacancy risk",
            actionKey: "open_vacancy_readiness_flow",
            actionLabel: "Review vacancy readiness",
            destination: "/analytics",
            workflowCategory: "vacancy_readiness",
            automationEligible: false,
            automationState: "manual_only",
            automationReason: "This decision is guidance-only in v1 and does not map to an execution rule.",
            executionMappingState: "none",
            executionMapping: null,
            executionInputState: "none",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: null,
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/analytics",
            state: "pending",
            reviewedAt: null,
          },
        ],
      },
      predictive: {
        metrics: [
          {
            key: "projected_vacancy_risk",
            label: "Projected vacancy risk",
            riskLevel: "medium",
            status: "supported",
            explanation: "Vacancy pressure is present in the current view, but it is not yet at the highest-risk threshold.",
            supportingValues: {
              vacancyRate: 0.2,
            },
          },
        ],
      },
      insights: [],
      comparisons: {
        previousPeriod: {
          summary: {
            occupiedUnits: 3,
            vacancyRate: 0.3,
            activeApplications: 1,
            applicationConversionRate: 0.2,
            openWorkOrders: 2,
            maintenanceCostCents: 4000,
            estimatedScheduledRentCents: 620000,
            leasesEndingSoon: 2,
          },
          applications: {
            started: 2,
            submitted: 2,
            approved: 1,
            rejected: 0,
            declined: 0,
            pendingReviewCount: 1,
            conversionRate: 0.2,
          },
          leasing: {
            totalProperties: 2,
            totalUnits: 5,
            occupiedUnits: 3,
            vacantUnits: 2,
            occupancyRate: 0.6,
            leasesEndingIn30Days: 2,
            leasesEndingIn60Days: 2,
            leasesEndingIn90Days: 2,
            turnoverCount: 0,
          },
          maintenance: {
            openWorkOrders: 2,
            completedWorkOrders: 1,
            reopenedWorkOrders: 0,
            maintenanceCostCents: 4000,
            averageCostPerCompletedWorkOrderCents: 4000,
            costConcentrationByProperty: [],
          },
          revenue: {
            estimatedScheduledRentCents: 620000,
            averageRentPerOccupiedUnitCents: 155000,
          },
        },
        deltas: {
          summary: {
            occupiedUnits: { current: 4, prior: 3, absoluteDelta: 1, relativeDelta: 0.3333, direction: "better" },
          },
          applications: {},
          leasing: {},
          maintenance: {},
          revenue: {},
        },
      },
      properties: [{ id: "prop-123", name: "Alpha" }],
      propertyMetrics: [],
      filters: {
        period: "90d",
        propertyId: null,
        from: "2026-01-20T00:00:00.000Z",
        to: "2026-04-20T00:00:00.000Z",
      },
    });
  });

  it("returns landlord-scoped analytics without allowing scope override", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics?period=90d&propertyId=prop-123&landlordId=other-landlord",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-123",
    });
    expect(response.body.ok).toBe(true);
    expect(response.body.summary.occupiedUnits).toBe(4);
    expect(response.body.decisions.items[0].decisionType).toBe("reduce_vacancy_risk");
    expect(response.body.predictive.metrics[0].key).toBe("projected_vacancy_risk");
    expect(response.body.comparisons.deltas.summary.occupiedUnits.direction).toBe("better");
  });

  it("marks a visible landlord decision as reviewed and emits a canonical event", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/reduce_vacancy_risk%3Aprop-123/review?period=90d&propertyId=prop-123",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(loadLandlordAnalyticsSnapshot).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      period: "90d",
      propertyId: "prop-123",
    });
    expect(saveReviewedLandlordDecisionState).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
    });
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "decision.reviewed",
        resource: { type: "analytics_decision", id: "reduce_vacancy_risk:prop-123" },
        metadata: expect.objectContaining({
          landlordId: "landlord-1",
          decisionType: "reduce_vacancy_risk",
        }),
      })
    );
    expect(response.body.state).toEqual(
      expect.objectContaining({
        decisionId: "reduce_vacancy_risk:prop-123",
        state: "reviewed",
      })
    );
  });

  it("rejects review requests for decisions that are not currently visible", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/review_revenue_pressure/review",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ ok: false, error: "DECISION_NOT_VISIBLE" });
    expect(saveReviewedLandlordDecisionState).not.toHaveBeenCalled();
    expect(writeCanonicalEvent).not.toHaveBeenCalled();
  });

  it("snoozes a visible landlord decision and emits a canonical event", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/reduce_vacancy_risk%3Aprop-123/snooze?period=90d&propertyId=prop-123",
      user: { id: "landlord-1", role: "landlord" },
      body: { snoozedUntil: "2026-04-23T12:00:00.000Z" },
    });

    expect(response.status).toBe(200);
    expect(saveSnoozedLandlordDecisionState).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
      snoozedUntil: "2026-04-23T12:00:00.000Z",
    });
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "decision.snoozed",
        metadata: expect.objectContaining({
          decisionType: "reduce_vacancy_risk",
          snoozedUntil: "2026-04-23T12:00:00.000Z",
        }),
      })
    );
    expect(response.body.state).toEqual(
      expect.objectContaining({
        decisionId: "reduce_vacancy_risk:prop-123",
        state: "snoozed",
      })
    );
  });

  it("dismisses a visible landlord decision and emits a canonical event", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/reduce_vacancy_risk%3Aprop-123/dismiss?period=90d&propertyId=prop-123",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(saveDismissedLandlordDecisionState).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      decisionId: "reduce_vacancy_risk:prop-123",
    });
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "decision.dismissed",
        metadata: expect.objectContaining({
          decisionType: "reduce_vacancy_risk",
        }),
      })
    );
    expect(response.body.state).toEqual(
      expect.objectContaining({
        decisionId: "reduce_vacancy_risk:prop-123",
        state: "dismissed",
      })
    );
  });

  it("executes a visible ready mapped complete lease-renewal decision", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValueOnce({
      decisions: {
        items: [
          {
            id: "review_lease_renewals:prop-1",
            decisionType: "review_lease_renewals",
            priority: "high",
            explanation: "Review renewals.",
            supportingSignals: [],
            recommendedAction: "Review renewals",
            actionKey: "open_lease_renewals_flow",
            actionLabel: "Open renewals focus",
            destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
            workflowCategory: "lease_renewals",
            automationEligible: true,
            automationState: "ready",
            automationReason: "This decision is active and already mapped to a deterministic automation path.",
            executionMappingState: "mapped",
            executionMapping: {
              action: "lease.auto_send_notice",
              resourceType: "lease",
              resourceId: "lease-1",
              prerequisitesMet: true,
              prerequisiteReason: null,
            },
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: {
              noticeType: "renewal_offer",
              legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
              noticeRuleVersion: "ns-v1",
              province: "NS",
              leaseType: "fixed_term",
              currentRent: 1650,
              noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
              rentChangeMode: "no_change",
              proposedRent: null,
              newTermType: "fixed_term",
              newLeaseStartDate: "2026-05-11",
              newLeaseEndDate: "2027-05-10",
              responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
            },
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
            state: "pending",
            reviewedAt: null,
          },
        ],
      },
    });

    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/review_lease_renewals%3Aprop-1/execute",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(200);
    expect(executeAutomation).toHaveBeenCalled();
    expect(saveExecutedLandlordDecisionState).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
    });
    expect(performLeaseNoticeSendFromPreviewInput).toHaveBeenCalled();
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "decision.execution_requested",
        metadata: expect.objectContaining({
          decisionId: "review_lease_renewals:prop-1",
          action: "lease.auto_send_notice",
          resourceId: "lease-1",
        }),
      })
    );
    expect(writeCanonicalEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "decision.executed",
      })
    );
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: true,
        execution: expect.objectContaining({
          decisionId: "review_lease_renewals:prop-1",
          action: "lease.auto_send_notice",
          resourceId: "lease-1",
        }),
        state: expect.objectContaining({
          state: "executed",
          executionOutcomeStatus: "succeeded",
        }),
      })
    );
  });

  it("fails closed when a visible decision is not ready for execution", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/reduce_vacancy_risk%3Aprop-123/execute",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "DECISION_NOT_READY",
      })
    );
    expect(executeAutomation).not.toHaveBeenCalled();
  });

  it("persists failed execution feedback without resolving the decision", async () => {
    loadLandlordAnalyticsSnapshot.mockResolvedValueOnce({
      decisions: {
        items: [
          {
            id: "review_lease_renewals:prop-1",
            decisionType: "review_lease_renewals",
            priority: "high",
            explanation: "Review renewals.",
            supportingSignals: [],
            recommendedAction: "Review renewals",
            actionKey: "open_lease_renewals_flow",
            actionLabel: "Open renewals focus",
            destination: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
            workflowCategory: "lease_renewals",
            automationEligible: true,
            automationState: "ready",
            automationReason: "This decision is active and already mapped to a deterministic automation path.",
            executionMappingState: "mapped",
            executionMapping: {
              action: "lease.auto_send_notice",
              resourceType: "lease",
              resourceId: "lease-1",
              prerequisitesMet: true,
              prerequisiteReason: null,
            },
            executionInputState: "complete",
            executionInputReason: null,
            executionInputMissingFields: [],
            executionInput: {
              noticeType: "renewal_offer",
              legalTemplateKey: "ns.fixed_term.renewal_offer.v1",
              noticeRuleVersion: "ns-v1",
              province: "NS",
              leaseType: "fixed_term",
              currentRent: 1650,
              noticeDueAt: Date.UTC(2026, 1, 10, 0, 0, 0, 0),
              rentChangeMode: "no_change",
              proposedRent: null,
              newTermType: "fixed_term",
              newLeaseStartDate: "2026-05-11",
              newLeaseEndDate: "2027-05-10",
              responseDeadlineAt: Date.UTC(2026, 4, 1, 12, 0, 0, 0),
            },
            executedAt: null,
            executionOutcomeStatus: "none",
            executionOutcomeAt: null,
            executionOutcomeReason: null,
            href: "/portfolio-health?entry=lease-renewals&propertyId=prop-1",
            state: "pending",
            reviewedAt: null,
          },
        ],
      },
    });
    executeAutomation.mockResolvedValueOnce({
      automationResult: {
        action: "lease.auto_send_notice",
        executed: false,
        skipped: true,
        reason: "AUTOMATION_EXECUTION_FAILED",
        timestamp: "2026-04-20T12:00:00.000Z",
      },
    });

    const router = (await import("../landlordAnalyticsRoutes")).default;
    const response = await invokeRouter(router, {
      method: "POST",
      url: "/landlord/analytics/decisions/review_lease_renewals%3Aprop-1/execute",
      user: { id: "landlord-1", role: "landlord" },
    });

    expect(response.status).toBe(409);
    expect(saveFailedLandlordDecisionExecutionOutcome).toHaveBeenCalledWith({
      landlordId: "landlord-1",
      decisionId: "review_lease_renewals:prop-1",
      reason: "AUTOMATION_EXECUTION_FAILED",
    });
    expect(saveExecutedLandlordDecisionState).not.toHaveBeenCalled();
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: "DECISION_EXECUTION_FAILED",
        state: expect.objectContaining({
          state: "pending",
          executionOutcomeStatus: "failed",
          executionOutcomeReason: "AUTOMATION_EXECUTION_FAILED",
        }),
      })
    );
  });

  it("enforces landlord authentication", async () => {
    const router = (await import("../landlordAnalyticsRoutes")).default;

    const forbidden = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics",
      user: { id: "tenant-1", role: "tenant" },
    });
    expect(forbidden.status).toBe(403);

    const unauthorized = await invokeRouter(router, {
      method: "GET",
      url: "/landlord/analytics",
      user: null,
    });
    expect(unauthorized.status).toBe(401);
  });
});
