import { Router } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import {
  enrollTenant,
  listEnrollments,
} from "../services/rentReportingService";

const router = Router();

router.use(authenticateJwt);

router.post("/enroll", (req, res) => {
  const { tenantId, propertyId, unit, leaseStartDate, consent } = req.body || {};

  if (!consent) {
    return res.status(400).json({ error: "Consent is required to enroll" });
  }
  if (!tenantId || !propertyId || !unit || !leaseStartDate) {
    return res
      .status(400)
      .json({ error: "tenantId, propertyId, unit, leaseStartDate are required" });
  }

  const enrollment = enrollTenant({
    tenantId: String(tenantId),
    propertyId: String(propertyId),
    tenantName: "Tenant", // placeholder until tenant profile is linked
    tenantEmail: "tenant@example.com",
    tenantPhone: undefined,
    unit: String(unit),
    leaseStartDate: String(leaseStartDate),
    consentedAt: new Date().toISOString(),
  });

  return res.status(201).json({ enrollment });
});

router.get("/enrollments", (_req, res) => {
  return res.status(200).json({ enrollments: listEnrollments() });
});

export default router;
