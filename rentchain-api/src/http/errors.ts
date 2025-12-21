export type UpgradeRequiredError = {
  error: "upgrade_required";
  message: string;
  plan: string;
  required?: string;
  limit?: Record<string, number>;
  current?: Record<string, number>;
  upgradeHint?: string;
};

export function upgradeRequired(input: Omit<UpgradeRequiredError, "error">): UpgradeRequiredError {
  return { error: "upgrade_required", ...input };
}
