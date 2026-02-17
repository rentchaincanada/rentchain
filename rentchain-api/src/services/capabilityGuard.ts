import { type CapabilityKey } from "../config/capabilities";
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
