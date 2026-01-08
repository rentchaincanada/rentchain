import { Router } from "express";
import { convertApplicationToTenant } from "../services/applicationConversionService";
import { recomputeTenantSnapshot } from "./tenantEventsWriteRoutes";

const router = Router();

router.post(
  "/:applicationId/convert-to-tenant",
  async (req: any, res) => {
    res.setHeader("x-route-source", "applicationsConversionRoutes");

    try {
      const landlordId = req.user?.landlordId || req.user?.id;
      const actorUserId = req.user?.id;
      if (!landlordId || !actorUserId) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }

      const applicationId = String(req.params?.applicationId || "").trim();
      if (!applicationId || applicationId === "a1" || applicationId === "a2") {
        return res.status(400).json({ ok: false, error: "Invalid applicationId" });
      }

      const runScreening = !!req.body?.runScreening;

      console.log("[applications/convert] appId=", applicationId);

      const result = await convertApplicationToTenant({
        landlordId,
        applicationId,
        runScreening,
        actorUserId,
      });

      try {
        if (result?.tenantId) {
          await recomputeTenantSnapshot({ landlordId, tenantId: result.tenantId });
        }
      } catch (err) {
        console.warn("[applications/:applicationId/convert-to-tenant] snapshot recompute failed", err);
      }

      return res.status(200).json({
        ok: true,
        applicationId,
        tenantId: result.tenantId,
        alreadyConverted: !!result.alreadyConverted,
        screening: result.screening ?? null,
      });
    } catch (err: any) {
      console.error("[applications/:id/convert-to-tenant] error", err);
      const message = err?.message || "Conversion failed";
      const code =
        message === "Forbidden" ? 403 : message === "Application not found" ? 404 : 500;
      return res.status(code).json({ ok: false, error: message, message });
    }
  }
);

export default router;
