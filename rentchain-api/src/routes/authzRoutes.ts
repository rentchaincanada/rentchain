import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { getEffectivePermissions } from "../auth/rbac";

const router = Router();

router.get("/authz/me", requireAuth, (req: any, res) => {
  const u = req.user || {};
  return res.json({
    ok: true,
    user: {
      id: u.id,
      email: u.email,
      role: u.role,
      landlordId: u.landlordId,
      tenantId: u.tenantId,
      permissions: u.permissions ?? [],
      revokedPermissions: u.revokedPermissions ?? [],
    },
  });
});

router.get("/authz/me/effective", requireAuth, (req: any, res) => {
  const u = req.user;
  const effective = getEffectivePermissions({
    role: u.role,
    extraPermissions: u.permissions ?? [],
    revokedPermissions: u.revokedPermissions ?? [],
  });

  return res.json({
    ok: true,
    role: u.role,
    effectivePermissions: [...effective].sort(),
  });
});

export default router;
