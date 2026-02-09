import { getApplicationPrereqState } from "./applicationPrereqs";

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
};

export function buildOnboardingSteps({
  onboarding,
  navigate,
  track,
  propertiesCount = 0,
  unitsCount = 0,
}: BuildArgs): OnboardingStep[] {
  const prereq = getApplicationPrereqState({ propertiesCount, unitsCount });
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
    navigate("/applications?autoSelectProperty=1&openSendApplication=1");
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
      description: "Add units so you can invite tenants and track rent.",
      isComplete: !!onboarding.steps.unitAdded,
      actionLabel: "Add units",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "unitAdded" });
        navigate("/properties?openAddUnit=1");
      },
    },
    {
      key: "tenantInvited",
      title: "Invite a tenant",
      description: "Send your first tenant invite.",
      isComplete: !!onboarding.steps.tenantInvited,
      actionLabel: "Invite tenant",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "tenantInvited" });
        navigate("/tenants?invite=1");
      },
    },
    {
      key: "applicationCreated",
      title: "Create an application",
      description: "Invite an applicant or start an application record.",
      isComplete: !!onboarding.steps.applicationCreated,
      actionLabel: "Send application link",
      onAction: routeToCreateApplication,
      isPrimary: true,
    },
    {
      key: "exportPreviewed",
      title: "Preview export (Pro)",
      description: "See the export preview and unlock Pro when you're ready.",
      isComplete: !!onboarding.steps.exportPreviewed,
      actionLabel: "Preview export",
      onAction: () => {
        track("onboarding_step_clicked", { stepKey: "exportPreviewed" });
        navigate("/pdf/sample");
      },
    },
  ];
}
