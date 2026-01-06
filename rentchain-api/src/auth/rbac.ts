export type Role =
  | "owner"
  | "admin"
  | "landlord"
  | "manager"
  | "staff"
  | "tenant"
  | "auditor";

export type Permission =
  | "properties.create"
  | "properties.edit"
  | "properties.archive"
  | "units.manage"
  | "tenants.manage"
  | "leases.edit"
  | "payments.record"
  | "payments.edit"
  | "ledger.record"
  | "ledger.view"
  | "reports.view"
  | "reports.export"
  | "users.invite"
  | "billing.manage"
  | "system.admin";

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  owner: ["system.admin"],
  admin: ["system.admin"],
  landlord: [
    "properties.create",
    "properties.edit",
    "properties.archive",
    "units.manage",
    "tenants.manage",
    "leases.edit",
    "payments.record",
    "payments.edit",
    "ledger.record",
    "ledger.view",
    "reports.view",
    "reports.export",
    "users.invite",
    "billing.manage",
  ],
  manager: [
    "properties.edit",
    "units.manage",
    "tenants.manage",
    "leases.edit",
    "payments.record",
    "ledger.record",
    "ledger.view",
    "reports.view",
  ],
  staff: ["ledger.view", "reports.view"],
  tenant: ["ledger.view"],
  auditor: ["ledger.view", "reports.view"],
};

export function getEffectivePermissions(params: {
  role: Role;
  extraPermissions?: Permission[];
  revokedPermissions?: Permission[];
}) {
  const base = new Set(ROLE_PERMISSIONS[params.role] ?? []);
  for (const p of params.extraPermissions ?? []) base.add(p);
  for (const p of params.revokedPermissions ?? []) base.delete(p);
  return base;
}
