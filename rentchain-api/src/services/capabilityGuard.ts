import { type CapabilityKey } from "../config/capabilities";
import {
  canonicalPlanLabel,
  requiredPlanForCapability,
  resolveCanonicalPlan,
} from "./entitlements/planCapabilities";
import {
  getEntitlementsForLandlord,
  getUserEntitlements,
  type UserEntitlements,
} from "./entitlementsService";

type CapabilityCheck =
  | { ok: true; plan: string }
  | { ok: false; plan: string; error: "forbidden" };

type RequestUserLike = {
  id?: string;
  role?: string;
  plan?: string;
  capabilities?: string[];
  entitlements?: UserEntitlements;
};

const UPGRADE_DRIVER_COPY: Record<string, string[]> = {
  leases: ["Screening", "Payments"],
  ledger: ["Payments", "Analytics"],
  ledger_basic: ["Payments", "Analytics"],
  ledger_verified: ["Payments", "Analytics"],
  messaging: ["Work Orders"],
  operations_signals: ["Analytics", "Payments", "Work Orders", "Screening"],
  maintenance: ["Work Orders"],
  work_orders: ["Work Orders"],
  "expenses.import": ["Expenses", "Analytics"],
  "expenses.export": ["Expenses", "Analytics"],
  expenses_import: ["Expenses", "Analytics"],
  expenses_export: ["Expenses", "Analytics"],
  exports: ["Expenses", "Analytics"],
  exports_basic: ["Expenses", "Analytics"],
  pdf_export: ["Expenses", "Analytics"],
  screening: ["Screening"],
  screening_workflow: ["Screening"],
};

function resolveUpgradeDrivers(capability: string): string[] {
  const normalized = capability.trim().toLowerCase();
  if (UPGRADE_DRIVER_COPY[normalized]) return UPGRADE_DRIVER_COPY[normalized];
  if (normalized.includes("expense") || normalized.includes("export")) return ["Expenses", "Analytics"];
  if (normalized.includes("ledger") || normalized.includes("payment")) return ["Payments", "Analytics"];
  if (normalized.includes("message")) return ["Work Orders"];
  if (normalized.includes("screening")) return ["Screening"];
  if (normalized.includes("work_order") || normalized.includes("maintenance")) return ["Work Orders"];
  return ["Analytics"];
}

export async function requireCapability(
  landlordId: string,
  capability: CapabilityKey,
  user?: RequestUserLike
): Promise<CapabilityCheck> {
  const role = String(user?.role || user?.entitlements?.role || "").toLowerCase();
  if (role === "admin") {
    return { ok: true, plan: String(user?.plan || user?.entitlements?.plan || "elite") };
  }

  let entitlements: UserEntitlements | null = user?.entitlements || null;
  if (!entitlements && user?.id) {
    entitlements = await getUserEntitlements(String(user.id), {
      claimsRole: user.role,
      claimsPlan: user.plan,
      landlordIdHint: landlordId,
    });
  }
  if (!entitlements) {
    entitlements = await getEntitlementsForLandlord(landlordId);
  }

  const capabilityList = Array.isArray(entitlements.capabilities) ? entitlements.capabilities : [];
  const allowed = capabilityList.includes(capability);
  if (!allowed) {
    return { ok: false, plan: entitlements.plan, error: "forbidden" };
  }
  return { ok: true, plan: entitlements.plan };
}

export function buildUpgradeRequiredResponse(params: {
  capability: CapabilityKey | string;
  currentPlan?: string | null;
  source: string;
}) {
  const capability = String(params.capability || "").trim();
  const currentPlan = resolveCanonicalPlan(params.currentPlan);
  const requiredPlan = requiredPlanForCapability(capability) || "pro";
  const requiredPlanLabel = canonicalPlanLabel(requiredPlan);
  const upgradeDrivers = resolveUpgradeDrivers(capability);
  const driverCopy = upgradeDrivers.join(", ");
  const userMessage = `Upgrade to ${requiredPlanLabel} to unlock ${driverCopy}.`;

  return {
    ok: false,
    error: "upgrade_required",
    capability,
    plan: currentPlan,
    currentPlan,
    requiredPlan,
    requiredTier: requiredPlan,
    userMessage,
    upgradeDrivers,
    source: params.source,
    upgradePath: `/pricing?tier=${requiredPlan}`,
    message: `${requiredPlanLabel} is required to use this feature.`,
  };
}
