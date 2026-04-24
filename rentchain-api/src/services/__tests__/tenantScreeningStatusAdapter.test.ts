import { describe, expect, it } from "vitest";
import { adaptTenantSafeScreeningState } from "../screening/tenantScreeningStatusAdapter";

describe("adaptTenantSafeScreeningState", () => {
  it("maps consent-pending and missing consent to consent_required", () => {
    const state = adaptTenantSafeScreeningState({
      requestStatus: "consent_pending",
      nextAction: "awaiting_applicant_consent",
      consentAcceptedAt: null,
    });
    expect(state.tenantStatus).toBe("consent_required");
    expect(state.tenantNextAction).toBe("authorize_screening");
  });

  it("maps consented to consent_confirmed", () => {
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: "consented",
        consentAcceptedAt: 123,
      }).tenantStatus,
    ).toBe("consent_confirmed");
  });

  it("maps requested and in-progress states to screening_in_progress when consent exists", () => {
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: "requested",
        consentAcceptedAt: 123,
      }).tenantStatus,
    ).toBe("screening_in_progress");
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: "in_progress",
        sessionStatus: "redirect_pending",
        consentAcceptedAt: 123,
      }).tenantStatus,
    ).toBe("screening_in_progress");
  });

  it("maps completed to completed", () => {
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: "completed",
        resultStatus: "completed",
      }).tenantStatus,
    ).toBe("completed");
  });

  it("maps manual-review states to manual_review", () => {
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: "manual_review_required",
      }).tenantStatus,
    ).toBe("manual_review");
  });

  it("maps provider setup and failure states to blocked", () => {
    const state = adaptTenantSafeScreeningState({
      requestStatus: "failed",
      nextAction: "provider_activation_pending",
    });
    expect(state.tenantStatus).toBe("blocked");
    expect(state.tenantNextAction).toBe("wait_for_landlord");
  });

  it("maps unknown states to unavailable", () => {
    expect(
      adaptTenantSafeScreeningState({
        requestStatus: null,
        nextAction: null,
        consentAcceptedAt: null,
      }).tenantStatus,
    ).toBe("unavailable");
  });
});
