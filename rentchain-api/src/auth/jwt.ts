import jwt from "jsonwebtoken";
import type { Role, Permission } from "./rbac";

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) {
  console.warn("[auth] Missing JWT_SECRET");
}

export type JwtClaimsV1 = {
  sub: string; // userId
  email?: string;
  role: Role;
  landlordId?: string;
  tenantId?: string;
  permissions?: Permission[];
  revokedPermissions?: Permission[];
  ver: 1;
  iat?: number;
  exp?: number;
};

export function signAuthToken(claims: Omit<JwtClaimsV1, "ver">, opts?: { expiresIn?: string }) {
  const payload: JwtClaimsV1 = { ...claims, ver: 1 };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: opts?.expiresIn ?? "7d" });
}

export function verifyAuthToken(token: string): JwtClaimsV1 {
  return jwt.verify(token, JWT_SECRET) as JwtClaimsV1;
}
