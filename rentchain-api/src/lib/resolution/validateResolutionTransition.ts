import type { ResolutionStatus } from "./resolutionTypes";

export const RESOLUTION_TRANSITION_ERROR_CODE = "RESOLUTION_STATUS_TRANSITION_INVALID";

const ALLOWED_TRANSITIONS: Record<ResolutionStatus, ResolutionStatus[]> = {
  open: ["acknowledged", "dismissed"],
  acknowledged: ["in_progress", "resolved", "dismissed"],
  in_progress: ["resolved", "dismissed"],
  resolved: [],
  dismissed: [],
};

export function validateResolutionTransition(fromStatus: ResolutionStatus, toStatus: ResolutionStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus] || [];
  if (!allowed.includes(toStatus)) {
    const error = new Error(`Resolution cannot move from ${fromStatus} to ${toStatus}.`);
    (error as any).code = RESOLUTION_TRANSITION_ERROR_CODE;
    throw error;
  }
}
