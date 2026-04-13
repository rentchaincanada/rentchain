import { describe, expect, it } from "vitest";
import { buildDepositPaymentFlowState } from "./depositPaymentFlowState";

describe("depositPaymentFlowState", () => {
  it("stays not requested while lease signing is still earlier in the workflow", () => {
    const result = buildDepositPaymentFlowState({
      audience: "landlord",
      signingWorkspace: {
        signingState: "not_ready_for_signing",
        label: "Not ready for signing",
        summary: "Lease signing",
        explanation: "Blocked.",
        currentActor: null,
        currentActorLabel: "Not surfaced yet",
        blockers: ["Signing is still blocked."],
        nextActions: ["Wait for the next step."],
        timelineEvent: null,
      },
    });

    expect(result.paymentState).toBe("not_requested");
    expect(result.timelineEvent).toBeNull();
  });

  it("shows requested when a signed lease still has an outstanding deposit", () => {
    const result = buildDepositPaymentFlowState({
      audience: "tenant",
      signingWorkspace: {
        signingState: "signed_or_completed",
        label: "Signed",
        summary: "Lease signing",
        explanation: "Complete.",
        currentActor: null,
        currentActorLabel: "Not surfaced yet",
        blockers: [],
        nextActions: ["Move forward."],
        timelineEvent: null,
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: "https://example.com/lease.pdf",
        depositCents: 150000,
        depositRequired: true,
      },
    });

    expect(result.paymentState).toBe("requested");
    expect(result.currentActor).toBe("tenant");
    expect(result.amountLabel).toBe("$1,500.00 deposit");
  });

  it("shows pending when an explicit payment status is in progress", () => {
    const result = buildDepositPaymentFlowState({
      audience: "tenant",
      signingWorkspace: {
        signingState: "signed_or_completed",
        label: "Signed",
        summary: "Lease signing",
        explanation: "Complete.",
        currentActor: null,
        currentActorLabel: "Not surfaced yet",
        blockers: [],
        nextActions: ["Move forward."],
        timelineEvent: null,
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: "https://example.com/lease.pdf",
        paymentStatus: "processing",
      },
    });

    expect(result.paymentState).toBe("pending");
    expect(result.timelineEvent?.title).toBe("Payment started");
  });

  it("shows paid when deposit receipt evidence is visible", () => {
    const result = buildDepositPaymentFlowState({
      audience: "tenant",
      signingWorkspace: {
        signingState: "signed_or_completed",
        label: "Signed",
        summary: "Lease signing",
        explanation: "Complete.",
        currentActor: null,
        currentActorLabel: "Not surfaced yet",
        blockers: [],
        nextActions: ["Move forward."],
        timelineEvent: null,
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: "https://example.com/lease.pdf",
        depositCents: 150000,
        depositReceivedAt: "2026-04-10T00:00:00.000Z",
      },
    });

    expect(result.paymentState).toBe("paid");
    expect(result.timelineEvent?.title).toBe("Payment completed");
  });

  it("shows needs attention when the visible payment status failed", () => {
    const result = buildDepositPaymentFlowState({
      audience: "tenant",
      signingWorkspace: {
        signingState: "signed_or_completed",
        label: "Signed",
        summary: "Lease signing",
        explanation: "Complete.",
        currentActor: null,
        currentActorLabel: "Not surfaced yet",
        blockers: [],
        nextActions: ["Move forward."],
        timelineEvent: null,
      },
      lease: {
        leaseId: "lease-1",
        startDate: "2026-05-01",
        endDate: "2027-04-30",
        monthlyRent: 1800,
        status: "signed",
        documentUrl: "https://example.com/lease.pdf",
        paymentStatus: "failed",
      },
    });

    expect(result.paymentState).toBe("needs_attention");
    expect(result.timelineEvent?.actionRequired).toBe(true);
  });
});
