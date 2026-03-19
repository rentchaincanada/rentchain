import { buildMoveInRequirements, type MoveInRequirementsParams } from "./moveInRequirements";

export type MoveInReadinessStatus = "not-started" | "in-progress" | "ready" | "completed" | "unknown";

export interface MoveInReadiness {
  status: MoveInReadinessStatus;
  readinessPercent?: number | null;
  leaseSigned?: boolean | null;
  portalInviteSent?: boolean | null;
  portalActivated?: boolean | null;
  depositRequired?: boolean | null;
  depositReceived?: boolean | null;
  insuranceRequired?: boolean | null;
  insuranceReceived?: boolean | null;
  utilitySetupRequired?: boolean | null;
  utilitySetupReceived?: boolean | null;
  inspectionScheduled?: boolean | null;
  inspectionCompleted?: boolean | null;
  keysReleaseReady?: boolean | null;
  outstandingItems?: string[];
  completedItems?: string[];
  lastUpdatedAt?: string | null;
}

export type MoveInReadinessInviteState = MoveInRequirementsParams["invite"];
export type MoveInReadinessParams = MoveInRequirementsParams;

function stateToBoolean(state?: string | null): boolean | null {
  if (state === "complete") return true;
  if (state === "pending") return false;
  return null;
}

function findItem(items: Array<{ key: string; state: string; required: boolean; note?: string | null; label: string }>, key: string) {
  return items.find((item) => item.key === key) || null;
}

export function buildMoveInReadiness(params: MoveInReadinessParams): MoveInReadiness {
  const requirements = buildMoveInRequirements(params);
  const leaseRaw = params.leaseRaw || null;
  const tenancy = params.tenancy || null;

  const leaseSignedItem = findItem(requirements.items, "lease_signed");
  const portalInvitedItem = findItem(requirements.items, "portal_invited");
  const portalActivatedItem = findItem(requirements.items, "portal_activated");
  const depositItem = findItem(requirements.items, "deposit_received");
  const insuranceItem = findItem(requirements.items, "insurance_received");
  const utilityItem = findItem(requirements.items, "utility_setup_received");
  const inspectionScheduledItem = findItem(requirements.items, "inspection_scheduled");
  const inspectionCompletedItem = findItem(requirements.items, "inspection_completed");
  const keysReleaseReadyItem = findItem(requirements.items, "keys_release_ready");

  const keysReleased = Boolean(
    (leaseRaw as any)?.keysReleasedAt ||
      (leaseRaw as any)?.moveInCompletedAt ||
      (leaseRaw as any)?.keysReleased === true ||
      (leaseRaw as any)?.moveInCompleted === true ||
      tenancy?.moveInAt
  );

  const completedItems = requirements.items
    .filter((item) => item.state === "complete")
    .map((item) => item.label);

  if (keysReleased) {
    completedItems.push("Keys released");
  }
  if (tenancy?.moveInAt) {
    completedItems.push("Move-in recorded");
  }

  const outstandingItems = requirements.items
    .filter((item) => item.required && item.state === "pending")
    .map((item) => item.note || item.label);

  let status: MoveInReadinessStatus = "unknown";
  if (keysReleased) {
    status = "completed";
  } else if (requirements.status === "complete") {
    status = "ready";
  } else if (requirements.status === "in-progress") {
    status = "in-progress";
  } else if (requirements.status === "not-started") {
    status = "not-started";
  }

  return {
    status,
    readinessPercent: requirements.progressPercent ?? null,
    leaseSigned: stateToBoolean(leaseSignedItem?.state),
    portalInviteSent: stateToBoolean(portalInvitedItem?.state),
    portalActivated: stateToBoolean(portalActivatedItem?.state),
    depositRequired: depositItem ? depositItem.required : null,
    depositReceived: depositItem ? stateToBoolean(depositItem.state) ?? (depositItem.required ? false : false) : null,
    insuranceRequired: insuranceItem ? insuranceItem.required : null,
    insuranceReceived: insuranceItem ? stateToBoolean(insuranceItem.state) ?? (insuranceItem.required ? false : false) : null,
    utilitySetupRequired: utilityItem ? utilityItem.required : null,
    utilitySetupReceived: utilityItem ? stateToBoolean(utilityItem.state) ?? (utilityItem.required ? false : false) : null,
    inspectionScheduled: stateToBoolean(inspectionScheduledItem?.state),
    inspectionCompleted: stateToBoolean(inspectionCompletedItem?.state),
    keysReleaseReady: keysReleaseReadyItem ? stateToBoolean(keysReleaseReadyItem.state) : null,
    outstandingItems,
    completedItems,
    lastUpdatedAt: requirements.lastUpdatedAt ?? null,
  };
}
