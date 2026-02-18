import type { JwtClaimsV1 } from "../auth/jwt";
import type { Permission, Role } from "../auth/rbac";
import { db } from "../firebase";
import { getUserEntitlements, type UserEntitlements } from "./entitlementsService";

export type HydratedSessionUser = {
  id: string;
  email?: string;
  role: Role;
  landlordId?: string;
  tenantId?: string;
  approved?: boolean;
  plan?: string;
  capabilities?: string[];
  permissions?: Permission[];
  revokedPermissions?: Permission[];
  entitlements: UserEntitlements;
};

type BuildSessionUserOptions = {
  requestCache?: Record<string, UserEntitlements>;
  hydrateFromDb?: boolean;
};

type BaseUser = {
  id: string;
  email?: string;
  role: Role;
  landlordId?: string;
  tenantId?: string;
  permissions?: Permission[];
  revokedPermissions?: Permission[];
};

async function applyEntitlements(
  baseUser: BaseUser,
  approved: boolean,
  claimsPlan: string | null,
  requestCache: Record<string, UserEntitlements> | undefined
): Promise<HydratedSessionUser> {
  const entitlements = await getUserEntitlements(baseUser.id, {
    claimsRole: baseUser.role,
    claimsPlan,
    landlordIdHint: baseUser.landlordId,
    emailHint: baseUser.email,
    requestCache,
  });

  return {
    ...baseUser,
    role: entitlements.role as Role,
    landlordId:
      entitlements.landlordId ||
      (entitlements.role === "landlord" || entitlements.role === "admin"
        ? baseUser.id
        : baseUser.landlordId),
    approved: entitlements.role === "admin" || entitlements.role === "tenant" ? true : approved,
    plan: entitlements.plan,
    capabilities: entitlements.capabilities,
    entitlements,
  };
}

async function resolveApprovalFromLead(email?: string) {
  if (!email) return null;
  try {
    const leadSnap = await db
      .collection("landlordLeads")
      .where("email", "==", String(email).toLowerCase())
      .limit(1)
      .get();
    if (leadSnap.empty) return null;
    const lead = leadSnap.docs[0].data() as any;
    const status = String(lead?.status || "").toLowerCase();
    if (status === "approved" || status === "invited") return true;
    if (status === "pending" || status === "new" || status === "rejected") return false;
  } catch {
    // ignore lead lookup errors
  }
  return null;
}

export async function buildCanonicalSessionUserFromClaims(
  claims: JwtClaimsV1,
  options: BuildSessionUserOptions = {}
): Promise<HydratedSessionUser> {
  const baseUser: BaseUser = {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    landlordId: claims.landlordId,
    tenantId: claims.tenantId,
    permissions: claims.permissions ?? [],
    revokedPermissions: claims.revokedPermissions ?? [],
  };
  const claimsPlan = (claims as any)?.plan ?? null;
  const requestCache = options.requestCache;

  const hydrateFromDb =
    typeof options.hydrateFromDb === "boolean"
      ? options.hydrateFromDb
      : String(process.env.AUTH_HYDRATE_FROM_DB || "").toLowerCase() === "true";

  if (!hydrateFromDb) {
    let approved = true;
    if (baseUser.role === "landlord") {
      approved = true;
      const leadApproved = await resolveApprovalFromLead(baseUser.email);
      if (typeof leadApproved === "boolean") approved = leadApproved;
    }

    return applyEntitlements(
      {
        ...baseUser,
        landlordId:
          baseUser.role === "landlord" || baseUser.role === "admin"
            ? baseUser.landlordId || baseUser.id
            : baseUser.landlordId,
      },
      approved,
      claimsPlan,
      requestCache
    );
  }

  const snap = await db.collection("users").doc(baseUser.id).get();
  if (!snap.exists) {
    throw new Error("UNAUTHENTICATED");
  }

  const userDoc = snap.data() as any;
  if (userDoc?.disabled === true) {
    throw new Error("ACCOUNT_DISABLED");
  }

  if (userDoc?.landlordId && baseUser.landlordId && userDoc.landlordId !== baseUser.landlordId) {
    throw new Error("LANDLORD_SCOPE_MISMATCH");
  }

  if (userDoc?.tenantId && baseUser.tenantId && userDoc.tenantId !== baseUser.tenantId) {
    throw new Error("TENANT_SCOPE_MISMATCH");
  }

  let approved =
    baseUser.role === "admin" || baseUser.role === "tenant" ? true : userDoc?.approved === true;
  const hasApprovedField = Object.prototype.hasOwnProperty.call(userDoc || {}, "approved");

  if (baseUser.role === "landlord" && !approved && baseUser.email) {
    try {
      const leadSnap = await db
        .collection("landlordLeads")
        .where("email", "==", String(baseUser.email).toLowerCase())
        .limit(1)
        .get();
      if (!leadSnap.empty) {
        const lead = leadSnap.docs[0].data() as any;
        const status = String(lead?.status || "").toLowerCase();
        if (status === "approved" || status === "invited") {
          approved = true;
          await db.collection("users").doc(baseUser.id).set(
            {
              approved: true,
              approvedAt: Date.now(),
              approvedBy: lead?.approvedBy || "lead",
            },
            { merge: true }
          );
          await db.collection("accounts").doc(baseUser.id).set(
            {
              approved: true,
              approvedAt: Date.now(),
              approvedBy: lead?.approvedBy || "lead",
            },
            { merge: true }
          );
        } else if (status === "pending" || status === "new" || status === "rejected") {
          approved = false;
          if (!hasApprovedField) {
            await db.collection("users").doc(baseUser.id).set(
              {
                approved: false,
                approvedAt: null,
                approvedBy: null,
              },
              { merge: true }
            );
            await db.collection("accounts").doc(baseUser.id).set(
              {
                approved: false,
                approvedAt: null,
                approvedBy: null,
              },
              { merge: true }
            );
          }
        }
      } else if (!hasApprovedField) {
        approved = true;
      }
    } catch {
      if (!hasApprovedField) {
        approved = true;
      }
    }
  } else if (baseUser.role === "landlord" && !hasApprovedField && approved !== false) {
    approved = true;
  }

  return applyEntitlements(
    {
      id: baseUser.id,
      email: userDoc.email ?? baseUser.email,
      role: (userDoc.role ?? baseUser.role) as Role,
      landlordId:
        (userDoc.landlordId ?? baseUser.landlordId) ||
        (userDoc.role === "landlord" ||
        userDoc.role === "admin" ||
        baseUser.role === "landlord" ||
        baseUser.role === "admin"
          ? baseUser.id
          : undefined),
      tenantId: userDoc.tenantId ?? baseUser.tenantId,
      permissions: Array.isArray(userDoc.permissions) ? userDoc.permissions : baseUser.permissions,
      revokedPermissions: Array.isArray(userDoc.revokedPermissions)
        ? userDoc.revokedPermissions
        : baseUser.revokedPermissions,
    },
    approved,
    claimsPlan,
    requestCache
  );
}
