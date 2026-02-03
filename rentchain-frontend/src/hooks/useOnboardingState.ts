import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOnboarding, updateOnboarding } from "@/api/onboardingApi";
import { track } from "@/lib/analytics";

export type OnboardingSteps = {
  propertyAdded?: boolean;
  unitAdded?: boolean;
  tenantInvited?: boolean;
  applicationCreated?: boolean;
  exportPreviewed?: boolean;
};

const defaultSteps: OnboardingSteps = {
  propertyAdded: false,
  unitAdded: false,
  tenantInvited: false,
  applicationCreated: false,
  exportPreviewed: false,
};

export function useOnboardingState() {
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [steps, setSteps] = useState<OnboardingSteps>(defaultSteps);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res: any = await fetchOnboarding();
      setDismissed(Boolean(res?.dismissed));
      setSteps({ ...defaultSteps, ...(res?.steps || {}) });
      setLastSeenAt(res?.lastSeenAt || null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markStepComplete = useCallback(
    async (stepKey: keyof OnboardingSteps, method: "derived" | "explicit") => {
      setSteps((prev) => ({ ...prev, [stepKey]: true }));
      track("onboarding_step_completed", { stepKey, method });
      try {
        await updateOnboarding({ steps: { [stepKey]: true } });
      } catch {
        // ignore
      }
    },
    []
  );

  const dismissOnboarding = useCallback(async () => {
    setDismissed(true);
    track("onboarding_dismissed");
    try {
      await updateOnboarding({ dismissed: true });
    } catch {
      // ignore
    }
  }, []);

  const showOnboarding = useCallback(async () => {
    setDismissed(false);
    track("onboarding_viewed");
    try {
      await updateOnboarding({ dismissed: false });
    } catch {
      // ignore
    }
  }, []);

  const allComplete = useMemo(
    () =>
      Object.values({
        ...defaultSteps,
        ...steps,
      }).every(Boolean),
    [steps]
  );

  return {
    loading,
    dismissed,
    steps,
    lastSeenAt,
    allComplete,
    refresh,
    markStepComplete,
    dismissOnboarding,
    showOnboarding,
  };
}
