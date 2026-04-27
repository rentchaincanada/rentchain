import { describe, expect, it } from "vitest";
import { deriveLandlordTransUnionOnboardingAnalytics } from "../loadLandlordTransUnionOnboardingAnalytics";

describe("deriveLandlordTransUnionOnboardingAnalytics", () => {
  it("derives landlord-scoped onboarding counts and conversion safely", () => {
    const result = deriveLandlordTransUnionOnboardingAnalytics(
      [
        {
          type: "tu_onboarding_viewed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_onboarding_started",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_email_clicked",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_phone_clicked",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_already_credentialed_clicked",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_credentials_connected",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
        {
          type: "tu_onboarding_started",
          actor: { id: "user-2", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-2" },
          metadata: { providerKey: "transunion", landlordId: "landlord-2" },
        } as any,
      ],
      "landlord-1"
    );

    expect(result).toEqual({
      totals: {
        viewed: 1,
        started: 1,
        emailClicked: 1,
        phoneClicked: 1,
        alreadyCredentialedClicked: 1,
        connected: 1,
      },
      conversionRate: 1,
    });
  });

  it("fails closed to zero counts when no started event exists", () => {
    const result = deriveLandlordTransUnionOnboardingAnalytics(
      [
        {
          type: "tu_onboarding_viewed",
          actor: { id: "user-1", role: "landlord", type: "landlord" },
          resource: { type: "screening_provider", id: "transunion", parentType: "landlord", parentId: "landlord-1" },
          metadata: { providerKey: "transunion", landlordId: "landlord-1" },
        } as any,
      ],
      "landlord-1"
    );

    expect(result).toEqual({
      totals: {
        viewed: 1,
        started: 0,
        emailClicked: 0,
        phoneClicked: 0,
        alreadyCredentialedClicked: 0,
        connected: 0,
      },
      conversionRate: null,
    });
  });
});
