import { apiFetch } from "@/lib/apiClient";

export async function logTelemetryEvent(
  eventName: string,
  eventProps?: Record<string, unknown>
): Promise<void> {
  const normalized = String(eventName || "").trim().toLowerCase();
  if (!normalized.startsWith("nudge_")) return;
  try {
    await apiFetch("/telemetry", {
      method: "POST",
      body: JSON.stringify({
        eventName: normalized,
        eventProps: eventProps || {},
      }),
    });
  } catch {
    // non-blocking
  }
}
