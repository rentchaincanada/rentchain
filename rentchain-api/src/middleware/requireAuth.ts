import type { Request, Response, NextFunction } from "express";
import { verifyAuthToken, type JwtClaimsV1 } from "../auth/jwt";
import type { Role, Permission } from "../auth/rbac";
import { db } from "../firebase";
import { getUserEntitlements } from "../services/entitlementsService";

type HydratedUser = {
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
};

function getBearerToken(req: any): string | null {
  const raw = req.headers?.authorization || req.headers?.Authorization;
  if (!raw || typeof raw !== "string") return null;
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m?.[1] ?? null;
}

export async function requireAuth(req: any, res: any, next: any) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ ok: false, error: "Missing bearer token" });
    }

    const claims: JwtClaimsV1 = verifyAuthToken(token);

    const baseUser: HydratedUser = {
      id: claims.sub,
      email: claims.email,
      role: claims.role,
      landlordId: claims.landlordId,
      tenantId: claims.tenantId,
      permissions: claims.permissions ?? [],
      revokedPermissions: claims.revokedPermissions ?? [],
    };
    const claimsPlan = (claims as any)?.plan ?? null;

    const applyEntitlements = async (user: HydratedUser, approved: boolean) => {
      const entitlements = await getUserEntitlements(user.id, {
        claimsRole: user.role,
        claimsPlan,
        landlordIdHint: user.landlordId,
        emailHint: user.email,
      });
      req.user = {
        ...user,
        role: entitlements.role as Role,
        landlordId:
          entitlements.landlordId ||
          (entitlements.role === "landlord" || entitlements.role === "admin" ? user.id : user.landlordId),
        approved: entitlements.role === "admin" || entitlements.role === "tenant" ? true : approved,
        plan: entitlements.plan,
        capabilities: Array.from(entitlements.capabilities),
      };
      req.user.entitlements = entitlements;
      req.entitlements = entitlements;
    };

    const hydrate = String(process.env.AUTH_HYDRATE_FROM_DB || "").toLowerCase() === "true";
    if (!hydrate) {
      let approved = true;
      if (baseUser.role === "landlord") {
        approved = true;
        if (baseUser.email) {
          try {
            const leadSnap = await db
              .collection("landlordLeads")
              .where("email", "==", String(baseUser.email).toLowerCase())
              .limit(1)
              .get();
            if (!leadSnap.empty) {
              const lead = leadSnap.docs[0].data() as any;
              const status = String(lead?.status || "").toLowerCase();
              if (status === "pending" || status === "new" || status === "rejected") {
                approved = false;
              }
              if (status === "approved" || status === "invited") {
                approved = true;
              }
            }
          } catch {
            // ignore lead lookup errors
          }
        }
      }
      await applyEntitlements(
        {
          ...baseUser,
          landlordId:
            baseUser.role === "landlord" || baseUser.role === "admin"
              ? baseUser.landlordId || baseUser.id
              : baseUser.landlordId,
        },
        approved
      );
      return next();
    }

    const snap = await db.collection("users").doc(baseUser.id).get();
    if (!snap.exists) {
      return res.status(401).json({ ok: false, error: "User not found" });
    }

    const u = snap.data() as any;

    if (u?.disabled === true) {
      return res.status(403).json({ ok: false, error: "Account disabled" });
    }

    if (u?.landlordId && baseUser.landlordId && u.landlordId !== baseUser.landlordId) {
      return res.status(403).json({ ok: false, error: "Landlord scope mismatch" });
    }

    if (u?.tenantId && baseUser.tenantId && u.tenantId !== baseUser.tenantId) {
      return res.status(403).json({ ok: false, error: "Tenant scope mismatch" });
    }

    let approved =
      baseUser.role === "admin" || baseUser.role === "tenant"
        ? true
        : u?.approved === true;
    const hasApprovedField = Object.prototype.hasOwnProperty.call(u || {}, "approved");
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

    await applyEntitlements(
      {
      id: baseUser.id,
      email: u.email ?? baseUser.email,
      role: (u.role ?? baseUser.role) as Role,
      landlordId:
        (u.landlordId ?? baseUser.landlordId) ||
        ((u.role === "landlord" || u.role === "admin" || baseUser.role === "landlord" || baseUser.role === "admin")
          ? baseUser.id
          : undefined),
      tenantId: u.tenantId ?? baseUser.tenantId,
      approved,
      permissions: Array.isArray(u.permissions) ? u.permissions : baseUser.permissions,
      revokedPermissions: Array.isArray(u.revokedPermissions) ? u.revokedPermissions : baseUser.revokedPermissions,
      },
      approved
    );

    next();
  } catch {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}
