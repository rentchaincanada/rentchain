import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import {
  getComplianceRules,
  listComplianceProvinces,
  normalizeComplianceProvince,
} from "../services/complianceEngine";

const router = Router();

router.get("/rules", requireAuth, (req: any, res) => {
  const province = normalizeComplianceProvince(req.query?.province);
  if (!province) {
    return res.status(400).json({
      ok: false,
      error: "province_required",
      supportedProvinces: listComplianceProvinces(),
    });
  }

  const rules = getComplianceRules(province);
  return res.status(200).json({
    ok: true,
    province,
    complianceVersion: rules.complianceVersion,
    rules,
  });
});

export default router;
