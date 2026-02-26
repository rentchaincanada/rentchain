import type { AutomationEvent } from "./automationTimeline.types";

export function useAutomationTimeline() {
  const events: AutomationEvent[] = [];
  return { events, loading: false, error: null as string | null };
}
