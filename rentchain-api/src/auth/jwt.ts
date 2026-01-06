import jwt, { Secret, SignOptions } from "jsonwebtoken";
import type { Role, Permission } from "./rbac";

export type JwtClaimsV1 = {
  sub: string;
  email?: string;
  role: Role;
  landlordId?: string;
  tenantId?: string;
  permissions?: Permission[];
  revokedPermissions?: Permission[];
  ver: 1;
};

function requireJwtSecret(): Secret {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET_NOT_CONFIGURED");
  return secret;
}

export function signAuthToken(
  claims: Omit<JwtClaimsV1, "ver">,
  options?: SignOptions
): string {
  return jwt.sign(
    { ...claims, ver: 1 },
    requireJwtSecret(),
    { expiresIn: "7d", ...(options ?? {}) }
  );
}

export function verifyAuthToken(token: string): JwtClaimsV1 {
  return jwt.verify(token, requireJwtSecret()) as JwtClaimsV1;
}
