import crypto from "crypto";
import type { RecoveryAuthority, RecoveryAuthorityRole } from "../../types/recovery";

export function stableRecoveryHash(value: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex").slice(0, 20);
}

export function toUtcIso(value?: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  return new Date().toISOString();
}

export function asSafeText(value: unknown, max = 240): string {
  return String(value ?? "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function safeRef(prefix: string, value: unknown): string | null {
  const raw = String(value ?? "").trim();
  return raw ? `${prefix}:${stableRecoveryHash(raw)}` : null;
}

export function workflowKey(workflowType: string, workflowId: unknown): string {
  return `${workflowType}:instance:${stableRecoveryHash(workflowId)}`;
}

export function normalizeRecoveryAuthority(input: {
  role?: unknown;
  operatorId?: unknown;
  landlordId?: unknown;
}): RecoveryAuthority {
  const role = String(input.role ?? "").trim().toLowerCase() as RecoveryAuthorityRole;
  const normalizedRole: RecoveryAuthorityRole =
    role === "admin" || role === "support" || role === "landlord" || role === "tenant" || role === "system"
      ? role
      : "tenant";
  return {
    role: normalizedRole,
    operatorRef: safeRef("operator", input.operatorId),
    landlordRef: safeRef("access", input.landlordId),
    supportAllowed: normalizedRole === "support",
  };
}

export function isOperatorAuthority(authority: RecoveryAuthority): authority is RecoveryAuthority & { role: "admin" | "support" } {
  return authority.role === "admin" || authority.role === "support";
}
