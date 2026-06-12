export function isUpgradeRequiredError(error: unknown): boolean {
  const value =
    error instanceof Error
      ? error.message
      : typeof error === "string"
      ? error
      : (error as any)?.message || (error as any)?.error || "";
  const message = String(value || "").trim().toLowerCase();
  if (!message) return false;
  return (
    message === "upgrade_required" ||
    message === "upgrade required" ||
    message.includes("upgrade_required") ||
    message.includes("upgrade required") ||
    message.includes("is required to use this feature")
  );
}
