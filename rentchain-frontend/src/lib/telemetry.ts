export function isTelemetryEnabled(): boolean {
  const raw = String(import.meta.env?.VITE_TELEMETRY_ENABLED ?? "")
    .trim()
    .toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes" || raw === "on") return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return String(import.meta.env?.MODE || "").toLowerCase() !== "production";
}

