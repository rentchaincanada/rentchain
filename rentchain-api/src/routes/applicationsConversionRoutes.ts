import { Router } from "express";
import { convertApplicationToTenant } from "../services/applicationConversionService";

const router = Router();

router.post(
  "/applications/:applicationId/convert",
  async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { applicationId } = req.params;
      const { runScreening } = req.body || {};
      const result = await convertApplicationToTenant({
        landlordId: req.user.id,
        applicationId,
        runScreening: !!runScreening,
      });
      return res.status(200).json(result);
    } catch (err: any) {
      console.error("[applications/:id/convert] error", err);
      const message = err?.message || "Conversion failed";
      const code = message === "Forbidden" ? 403 : 500;
      return res.status(code).json({ error: message, message });
    }
  }
);

export default router;
