import type { AdminStorageStateFixture, SmokeRole, SmokeUser } from "../fixtures/admin-storage-state";

export type SmokeAuthHeaders = {
  authorization: string;
};

export function makeSmokeToken(role: SmokeRole) {
  return `smoke-${role}-token`;
}

export function getSmokeAuthHeaders(role: SmokeRole): SmokeAuthHeaders {
  return { authorization: `Bearer ${makeSmokeToken(role)}` };
}

export function resolveSmokeUser(fixture: AdminStorageStateFixture, headers?: Record<string, string>): SmokeUser | null {
  const raw = headers?.authorization || headers?.Authorization;
  const token = String(raw || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (token === makeSmokeToken("admin")) return fixture.users.find((user) => user.role === "admin") || null;
  if (token === makeSmokeToken("landlord")) return fixture.users.find((user) => user.role === "landlord") || null;
  if (token === makeSmokeToken("tenant")) return fixture.users.find((user) => user.role === "tenant") || null;
  return null;
}

export function hasAdminScope(user: SmokeUser | null) {
  return user?.role === "admin" && user.permissions.includes("system.admin");
}
