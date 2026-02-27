import type { AutomationEvent } from "./automationTimeline.types";
import { getMockAutomationEvents } from "./mockAutomationEvents";

export function useAutomationTimeline() {
  const events: AutomationEvent[] = getMockAutomationEvents();
  return { events, loading: false, error: null as string | null };
}
