import { describe, expect, it, vi } from "vitest";
import { buildOnboardingSteps } from "./onboardingSteps";

describe("buildOnboardingSteps", () => {
  it("orders landlord onboarding as property, unit, applicant, screening, lease", () => {
    const steps = buildOnboardingSteps({
      onboarding: {
        steps: {
          propertyAdded: false,
          unitAdded: false,
          applicationCreated: false,
          exportPreviewed: false,
          leasePackGenerated: false,
        },
      },
      navigate: vi.fn(),
      track: vi.fn(),
      propertiesCount: 0,
      unitsCount: 0,
    });

    expect(steps.map((step) => step.title)).toEqual([
      "Add your first property",
      "Add units",
      "Add an applicant",
      "Run screening",
      "Create lease",
    ]);
    expect(steps.find((step) => step.title === "Run screening")?.actionLabel).toBe("Track applicant");
  });

  it("routes free screening and lease actions through manual applicant intake until an application exists", () => {
    const navigate = vi.fn();
    const track = vi.fn();
    const steps = buildOnboardingSteps({
      onboarding: {
        steps: {
          propertyAdded: true,
          unitAdded: true,
          applicationCreated: false,
          exportPreviewed: false,
          leasePackGenerated: false,
        },
      },
      navigate,
      track,
      propertiesCount: 1,
      unitsCount: 1,
      plan: "free",
    });

    steps.find((step) => step.title === "Run screening")?.onAction();
    steps.find((step) => step.title === "Create lease")?.onAction();

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenNthCalledWith(1, "/applications");
    expect(navigate).toHaveBeenNthCalledWith(2, "/applications");
    expect(track).toHaveBeenCalledWith("onboarding_step_clicked", { stepKey: "applicationCreated" });
  });

  it("routes paid applicant setup to the application link workflow", () => {
    const navigate = vi.fn();
    const steps = buildOnboardingSteps({
      onboarding: {
        steps: {
          propertyAdded: true,
          unitAdded: true,
          applicationCreated: false,
          exportPreviewed: false,
          leasePackGenerated: false,
        },
      },
      navigate,
      track: vi.fn(),
      propertiesCount: 1,
      unitsCount: 1,
      plan: "starter",
    });

    steps.find((step) => step.title === "Add an applicant")?.onAction();

    expect(navigate).toHaveBeenCalledWith("/applications?autoSelectProperty=1&openSendApplication=1");
  });
});
