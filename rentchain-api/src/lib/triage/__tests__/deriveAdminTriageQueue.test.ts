import { describe, expect, it } from "vitest";
import { deriveAdminTriageQueue } from "../deriveAdminTriageQueue";

function canonicalEvent(id: string, data: any) {
  return {
    id,
    version: "v1",
    actor: { type: "system", role: "system", id: "system" },
    visibility: "internal",
    recordedAt: data.occurredAt,
    summary: data.summary || data.type,
    ...data,
  };
}

describe("deriveAdminTriageQueue", () => {
  it("maps screening reconciliation states into triage items", () => {
    const items = deriveAdminTriageQueue({
      now: Date.parse("2026-04-15T12:00:00.000Z"),
      applications: [
        {
          id: "app-1",
          applicantName: "Alex Applicant",
          screeningMonetization: {
            paymentStatus: "paid",
            paidAt: "2026-04-15T08:00:00.000Z",
            fulfillmentStatus: "ordered",
          },
        },
      ],
      canonicalEvents: [
        canonicalEvent("event-1", {
          type: "screening.paid",
          domain: "screening",
          action: "paid",
          resource: { type: "rental_application", id: "app-1" },
          occurredAt: "2026-04-15T08:00:00.000Z",
        }),
      ],
      screeningOrders: [],
      financialTransactions: [
        {
          applicationId: "app-1",
          type: "payment_succeeded",
          createdAt: Date.parse("2026-04-15T08:00:00.000Z"),
        },
      ],
    });

    expect(items[0]).toEqual(
      expect.objectContaining({
        category: "screening_reconciliation",
        severity: "critical",
        reason: expect.objectContaining({
          code: "TRIAGE_PAID_NOT_FULFILLED",
        }),
        resource: expect.objectContaining({
          type: "application",
          id: "app-1",
        }),
      })
    );
  });

  it("maps latest policy review and block events correctly", () => {
    const items = deriveAdminTriageQueue({
      applications: [
        { id: "app-1", applicantName: "Alex Applicant" },
      ],
      canonicalEvents: [
        canonicalEvent("event-1", {
          type: "policy.evaluated",
          domain: "policy",
          action: "evaluated",
          status: "review",
          resource: { type: "rental_application", id: "app-1" },
          occurredAt: "2026-04-15T09:00:00.000Z",
          metadata: {
            action: "start_checkout",
            outcome: "review",
            topReasonCode: "SCREENING_REVIEW_REQUIRED",
          },
        }),
      ],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "policy_review",
          severity: "medium",
          reason: expect.objectContaining({
            code: "TRIAGE_POLICY_REVIEW_REQUIRED",
          }),
          signals: expect.objectContaining({
            policyOutcome: "review",
          }),
        }),
      ])
    );
  });

  it("maps skipped automation correctly", () => {
    const items = deriveAdminTriageQueue({
      leases: [{ id: "lease-1", tenantName: "Taylor Tenant" }],
      canonicalEvents: [
        canonicalEvent("event-1", {
          type: "automation.skipped",
          domain: "system",
          action: "skipped",
          resource: { type: "lease", id: "lease-1" },
          occurredAt: "2026-04-15T10:00:00.000Z",
          metadata: {
            action: "lease.auto_send_notice",
            skipped: true,
            reason: "LEASE_AUTO_SEND_NOTICE_POLICY_BLOCKED",
          },
        }),
      ],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "automation_exception",
          reason: expect.objectContaining({
            code: "TRIAGE_AUTOMATION_SKIPPED",
          }),
          signals: expect.objectContaining({
            automationAction: "lease.auto_send_notice",
            automationExecuted: false,
          }),
        }),
      ])
    );
  });

  it("maps maintenance reopen and stall signals correctly", () => {
    const items = deriveAdminTriageQueue({
      now: Date.parse("2026-04-20T12:00:00.000Z"),
      maintenanceRequests: [
        { id: "maint-1", title: "Broken heater", status: "open" },
        { id: "maint-2", title: "Leaking sink", status: "assigned" },
      ],
      canonicalEvents: [
        canonicalEvent("event-1", {
          type: "maintenance.request_created",
          domain: "maintenance",
          action: "request_created",
          resource: { type: "maintenance_request", id: "maint-1" },
          occurredAt: "2026-04-10T09:00:00.000Z",
        }),
        canonicalEvent("event-2", {
          type: "maintenance.completed",
          domain: "maintenance",
          action: "completed",
          resource: { type: "maintenance_request", id: "maint-1" },
          occurredAt: "2026-04-11T09:00:00.000Z",
        }),
        canonicalEvent("event-3", {
          type: "maintenance.assigned",
          domain: "maintenance",
          action: "assigned",
          resource: { type: "maintenance_request", id: "maint-1" },
          occurredAt: "2026-04-12T09:00:00.000Z",
        }),
        canonicalEvent("event-4", {
          type: "maintenance.request_created",
          domain: "maintenance",
          action: "request_created",
          resource: { type: "maintenance_request", id: "maint-2" },
          occurredAt: "2026-04-15T09:00:00.000Z",
        }),
      ],
    });

    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "maintenance_friction",
          reason: expect.objectContaining({
            code: "TRIAGE_MAINTENANCE_REOPENED",
          }),
        }),
        expect.objectContaining({
          category: "workflow_stall",
          reason: expect.objectContaining({
            code: "TRIAGE_WORKFLOW_STALLED",
          }),
        }),
      ])
    );
  });

  it("applies severity sorting correctly", () => {
    const items = deriveAdminTriageQueue({
      now: Date.parse("2026-04-15T12:00:00.000Z"),
      applications: [{ id: "app-1", screeningMonetization: { paymentStatus: "paid", paidAt: "2026-04-15T08:00:00.000Z", fulfillmentStatus: "ordered" } }],
      maintenanceRequests: [{ id: "maint-1", title: "Broken heater", status: "assigned" }],
      canonicalEvents: [
        canonicalEvent("event-1", {
          type: "screening.paid",
          domain: "screening",
          action: "paid",
          resource: { type: "rental_application", id: "app-1" },
          occurredAt: "2026-04-15T08:00:00.000Z",
        }),
        canonicalEvent("event-2", {
          type: "maintenance.request_created",
          domain: "maintenance",
          action: "request_created",
          resource: { type: "maintenance_request", id: "maint-1" },
          occurredAt: "2026-04-13T08:00:00.000Z",
        }),
      ],
      financialTransactions: [{ applicationId: "app-1", type: "payment_succeeded", createdAt: Date.parse("2026-04-15T08:00:00.000Z") }],
    });

    expect(items[0]?.severity).toBe("critical");
  });
});

