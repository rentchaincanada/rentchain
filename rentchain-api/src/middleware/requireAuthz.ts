import type { Permission, Role } from "../auth/rbac";
import { getEffectivePermissions, hasPermission } from "../auth/rbac";

export function requirePermission(required: Permission | Permission[]) {
  return (req: any, res: any, next: any) => {
    const u = req.user;
    if (!u?.role) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const effective = getEffectivePermissions({
      role: u.role as Role,
      extraPermissions: u.permissions ?? [],
      revokedPermissions: u.revokedPermissions ?? [],
    });

    if (!hasPermission(effective, required)) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    req.userEffectivePermissions = [...effective];
    next();
  };
}
