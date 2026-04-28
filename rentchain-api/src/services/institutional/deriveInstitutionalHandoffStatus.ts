export type InstitutionalHandoffStatus = "draft" | "ready_for_manual_review" | "blocked" | "voided";

type DeriveInstitutionalHandoffStatusInput = {
  validationStatus: "valid" | "valid_with_warnings" | "invalid";
  readinessStatus: "not_ready" | "partial" | "ready";
};

export function deriveInstitutionalHandoffStatus(
  input: DeriveInstitutionalHandoffStatusInput
): InstitutionalHandoffStatus {
  if (input.validationStatus === "invalid" || input.readinessStatus === "not_ready") {
    return "blocked";
  }

  if (
    (input.validationStatus === "valid" || input.validationStatus === "valid_with_warnings") &&
    (input.readinessStatus === "partial" || input.readinessStatus === "ready")
  ) {
    return "ready_for_manual_review";
  }

  return "draft";
}
