import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth";
import { normalizeProvince } from "../lib/province";
import {
  getComplianceRules,
  listComplianceProvinces,
} from "../services/complianceEngine";

const router = Router();

router.get("/rules", requireAuth, (req: any, res) => {
  const rawProvince = String(req.query?.province || "").trim();
  if (!rawProvince) {
    return res.status(400).json({
      ok: false,
      error: "province_required",
    });
  }

  const normalized = normalizeProvince(rawProvince);
  if (!normalized) {
    return res.status(400).json({
      ok: false,
      error: "province_invalid",
    });
  }

  const supported = listComplianceProvinces();
  if (!supported.includes(normalized as "ON" | "NS")) {
    return res.status(400).json({
      ok: false,
      error: "province_invalid",
    });
  }

  const province = normalized as "ON" | "NS";
  const rules = getComplianceRules(province);
  return res.status(200).json({
    ok: true,
    province,
    complianceVersion: rules.complianceVersion,
    rules: {
      rentIncrease: rules.rentIncrease,
      leaseEnd: rules.leaseEnd,
      notices: rules.notices,
    },
  });
});

export default router;
