export type RequestAuthorityRole =
  | "admin"
  | "landlord"
  | "tenant"
  | "operator"
  | "contractor"
  | "support"
  | "unknown";

export type RequestAuthority = {
  actorId: string | null;
  actorRole: RequestAuthorityRole;
  userId: string | null;
  landlordId: string | null;
  tenantId: string | null;
  actorLandlordId: string | null;
  effectiveLandlordId: string | null;
  effectiveTenantId: string | null;
  isAdmin: boolean;
  isLandlord: boolean;
  isTenant: boolean;
  isSupport: boolean;
  authoritySource: string;
  warnings: string[];
  errors: string[];
};

function cleanString(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function normalizeRole(value: unknown): RequestAuthorityRole {
  const role = String(value ?? "").trim().toLowerCase();
  if (role === "admin") return "admin";
  if (role === "landlord") return "landlord";
  if (role === "tenant") return "tenant";
  if (role === "operator") return "operator";
  if (role === "contractor") return "contractor";
  if (role === "support") return "support";
  return "unknown";
}

export function resolveRequestAuthority(req: any): RequestAuthority {
  const user = req?.user || null;
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!user) {
    return {
      actorId: null,
      actorRole: "unknown",
      userId: null,
      landlordId: null,
      tenantId: null,
      actorLandlordId: null,
      effectiveLandlordId: null,
      effectiveTenantId: null,
      isAdmin: false,
      isLandlord: false,
      isTenant: false,
      isSupport: false,
      authoritySource: "missing_user",
      warnings,
      errors: ["missing_user"],
    };
  }

  const userId = cleanString(user.id || user.uid || user.sub);
  const actorId = cleanString(user.actorId || user.id || user.uid || user.sub);
  const role = normalizeRole(user.role);
  const actorRole = normalizeRole(user.actorRole || user.role);
  const landlordId = cleanString(user.landlordId);
  const tenantId = cleanString(user.tenantId);
  const actorLandlordId = cleanString(user.actorLandlordId);
  const isAdmin = actorRole === "admin" || role === "admin";
  const isLandlord = actorRole === "landlord" || role === "landlord";
  const isTenant = actorRole === "tenant" || role === "tenant";
  const isSupport = actorRole === "support" || role === "support" || actorRole === "operator" || role === "operator";

  if (!userId) errors.push("missing_user_id");
  if (actorRole === "unknown") warnings.push("unknown_actor_role");
  if (role === "unknown") warnings.push("unknown_user_role");
  if (actorLandlordId && landlordId && actorLandlordId !== landlordId) warnings.push("actor_landlord_scope_override");

  const fallbackLandlordId = isAdmin || isLandlord || isSupport ? userId : null;
  const effectiveLandlordId = actorLandlordId || landlordId || fallbackLandlordId || null;
  const effectiveTenantId = tenantId || (isTenant ? userId : null) || null;

  let authoritySource = "user";
  if (actorLandlordId) authoritySource = "actor_landlord_id";
  else if (landlordId) authoritySource = "landlord_id";
  else if (fallbackLandlordId) authoritySource = "user_id_fallback";
  else if (effectiveTenantId) authoritySource = tenantId ? "tenant_id" : "tenant_user_id_fallback";

  return {
    actorId,
    actorRole,
    userId,
    landlordId,
    tenantId,
    actorLandlordId,
    effectiveLandlordId,
    effectiveTenantId,
    isAdmin,
    isLandlord,
    isTenant,
    isSupport,
    authoritySource,
    warnings,
    errors,
  };
}

export function getEffectiveLandlordId(req: any): string | null {
  return resolveRequestAuthority(req).effectiveLandlordId;
}

export function getEffectiveTenantId(req: any): string | null {
  return resolveRequestAuthority(req).effectiveTenantId;
}

export function requireLandlordAuthority(req: any): RequestAuthority {
  const authority = resolveRequestAuthority(req);
  if (!authority.effectiveLandlordId) {
    authority.errors.push("missing_landlord_authority");
  }
  return authority;
}

export function requireTenantAuthority(req: any): RequestAuthority {
  const authority = resolveRequestAuthority(req);
  if (!authority.effectiveTenantId) {
    authority.errors.push("missing_tenant_authority");
  }
  return authority;
}

export function requireAdminAuthority(req: any): RequestAuthority {
  const authority = resolveRequestAuthority(req);
  if (!authority.isAdmin) {
    authority.errors.push("missing_admin_authority");
  }
  return authority;
}
