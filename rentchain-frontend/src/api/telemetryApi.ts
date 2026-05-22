import { apiFetch } from "./apiFetch";
import { isTelemetryEnabled } from "@/lib/telemetry";

export async function logTelemetryEvent(
  eventName: string,
  eventProps?: Record<string, unknown>
): Promise<void> {
  if (!isTelemetryEnabled()) return;
  const normalized = String(eventName || "").trim().toLowerCase();
  if (!normalized.startsWith("nudge_") && !normalized.startsWith("pdf_")) return;
  try {
    await apiFetch("/telemetry", {
      method: "POST",
      body: {
        eventName: normalized,
        eventProps: eventProps || {},
      },
    });
  } catch {
    // non-blocking
  }
}
