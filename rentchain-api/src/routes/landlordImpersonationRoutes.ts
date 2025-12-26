import { Router } from "express";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { requireRole } from "../middleware/requireRole";
import { requireMicroLiveAccess } from "../middleware/requireMicroLiveAccess";
import { JWT_SECRET } from "../config/authConfig";
import { logEvent } from "../services/telemetryService";

const router = Router();

router.use(requireRole("landlord"));
router.use(requireMicroLiveAccess);

router.post("/tenants/:tenantId/impersonate", async (req: any, res) => {
  const tenantId = String(req.params?.tenantId || "").trim();
  if (!tenantId) return res.status(400).json({ ok: false, error: "tenantId required" });

  const secret: Secret = JWT_SECRET || "dev-secret";
  const expiresIn = ("5m" as SignOptions["expiresIn"]);
  const payload = {
    sub: tenantId,
    tenantId,
    role: "tenant",
    actorRole: "landlord",
    actorLandlordId: req.user?.landlordId || req.user?.id || null,
    email: req.user?.email || null,
  };

  const token = jwt.sign(payload, secret, { expiresIn });
  const expMs = Date.now() + 5 * 60 * 1000;

  await logEvent({
    type: "tenant_impersonation_issued",
    landlordId: req.user?.landlordId || req.user?.id || null,
    actor: req.user?.email || req.user?.id || null,
    meta: { tenantId, exp: expMs },
  });

  return res.json({ ok: true, token, tenantId, exp: expMs });
});

export default router;
