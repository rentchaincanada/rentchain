import { getApplicationPrereqState } from "./applicationPrereqs";
import { normalizePlan, type Plan } from "./plan";

export type OnboardingStep = {
  key: string;
  title: string;
  description: string;
  isComplete: boolean;
  actionLabel: string;
  onAction: () => void;
  isPrimary?: boolean;
};

type OnboardingState = {
  steps: Record<string, boolean | undefined>;
};

type BuildArgs = {
  onboarding: OnboardingState;
  navigate: (path: string) => void;
  track: (eventName: string, props?: Record<string, unknown>) => void;
  propertiesCount?: number;
  unitsCount?: number;
  plan?: Plan | string;
};

export function buildOnboardingSteps({
  onboarding,
  navigate,
  track,
  propertiesCount = 0,
  unitsCount = 0,
  plan = "free",
}: BuildArgs): OnboardingStep[] {
  const prereq = getApplicationPrereqState({ propertiesCount, unitsCount });
  const currentPlan = normalizePlan(plan);
  const isFreePlan = currentPlan === "free";
  const routeToCreateApplication = () => {
    if (prereq.missingProperty) {
      track("onboarding_step_clicked", { stepKey: "applicationCreated", blockedBy: "no_property" });
      navigate("/properties?focus=addProperty");
      return;
    }
    if (prereq.missingUnit) {
      track("onboarding_step_clicked", { stepKey: "applicationCreated", blockedBy: "no_units" });
      navigate("/properties?openAddUnit=1");
      return;
    }
    track("onboarding_step_clicked", { stepKey: "applicationCreated" });
    navigate(isFreePlan ? "/applications" : "/applications?autoSelectProperty=1&openSendApplication=1");
  };

  return [
    {
      key: "propertyAdded",
      title: "Add your first property",
      description: "Create the property record to get started.",
      isComplete: !!onboarding.steps.propertyAdded,
      actionLabel: "Add property",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "propertyAdded" });
        navigate("/properties?focus=addProperty");
      },
    },
    {
      key: "unitAdded",
      title: "Add units",
      description: "Add units so applicants and lease records have property context.",
      isComplete: !!onboarding.steps.unitAdded,
      actionLabel: "Add units",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "unitAdded" });
        navigate("/properties?openAddUnit=1");
      },
    },
    {
      key: "applicationCreated",
      title: "Add an applicant",
      description: prereq.missingProperty
        ? "Add your first property before starting applicant intake."
        : prereq.missingUnit
        ? "Add a unit before starting applicant intake."
        : isFreePlan
        ? "Track applicant intake manually on Free. Starter adds secure application links."
        : "Send an application link or start an applicant record.",
      isComplete: !!onboarding.steps.applicationCreated,
      actionLabel: prereq.missingProperty
        ? "Add property"
        : prereq.missingUnit
        ? "Add unit"
        : isFreePlan
        ? "Track applicant"
        : "Add applicant",
      onAction: routeToCreateApplication,
      isPrimary: true,
    },
    {
      key: "exportPreviewed",
      title: "Run screening",
      description: onboarding.steps.applicationCreated
        ? "Review screening setup from Applications when the applicant is ready."
        : "Add an applicant before screening appears.",
      isComplete: !!onboarding.steps.exportPreviewed,
      actionLabel: onboarding.steps.applicationCreated ? "Review screening" : isFreePlan ? "Track applicant" : "Add applicant",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "exportPreviewed" });
        if (!onboarding.steps.applicationCreated) {
          routeToCreateApplication();
          return;
        }
        navigate("/applications?openTransUnionAccess=1");
      },
    },
    {
      key: "leasePackGenerated",
      title: "Create lease",
      description: onboarding.steps.applicationCreated
        ? "Create the lease after applicant and screening context exists."
        : "Add an applicant before preparing lease documents.",
      isComplete: !!onboarding.steps.leasePackGenerated,
      actionLabel: onboarding.steps.applicationCreated ? "Create lease" : isFreePlan ? "Track applicant" : "Add applicant",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "leasePackGenerated" });
        if (!onboarding.steps.applicationCreated) {
          routeToCreateApplication();
          return;
        }
        navigate("/properties?openLeasePack=1");
      },
    },
  ];
}
