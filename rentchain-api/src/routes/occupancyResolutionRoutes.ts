import { Router } from "express";
import { requireLandlord } from "../middleware/requireLandlord";
import { requireCapability } from "../services/capabilityGuard";
import {
  getOccupancyResolutionContext,
  OccupancyResolutionError,
  resolveOccupancy,
  type OccupancyResolutionType,
} from "../services/occupancyResolutionService";

const router = Router();
const TYPES = new Set<OccupancyResolutionType>([
  "record_operational_move_out",
  "clear_stale_occupancy_record",
  "link_existing_lease",
]);

function landlordId(req: any): string {
  return String(req.user?.landlordId || req.user?.id || "").trim();
}

async function enforceCapability(req: any, res: any) {
  if (String(req.user?.role || "").toLowerCase() === "admin") return true;
  const capability = await requireCapability(landlordId(req), "leases", req.user);
  if (capability.ok) return true;
  res.status(403).json({ ok: false, error: "Upgrade required", capability: "leases", plan: capability.plan });
  return false;
}

function handleError(res: any, error: unknown) {
  if (error instanceof OccupancyResolutionError) {
    return res.status(error.status).json({ ok: false, error: error.code, freshContext: error.freshContext || null });
  }
  console.error("[occupancy-resolutions] request failed", error);
  return res.status(500).json({ ok: false, error: "occupancy_resolution_failed" });
}

router.get("/context", requireLandlord, async (req: any, res) => {
  try {
    if (!(await enforceCapability(req, res))) return;
    const propertyId = String(req.query?.propertyId || "").trim();
    const unitId = String(req.query?.unitId || "").trim();
    const tenantId = String(req.query?.tenantId || "").trim() || null;
    if (!propertyId || !unitId) return res.status(400).json({ ok: false, error: "property_and_unit_required" });
    const context = await getOccupancyResolutionContext({ landlordId: landlordId(req), propertyId, unitId, tenantId });
    return res.status(200).json({ ok: true, context });
  } catch (error) {
    return handleError(res, error);
  }
});

router.post("/", requireLandlord, async (req: any, res) => {
  try {
    if (!(await enforceCapability(req, res))) return;
    const type = String(req.body?.type || "") as OccupancyResolutionType;
    if (!TYPES.has(type)) return res.status(400).json({ ok: false, error: "resolution_type_invalid" });
    const propertyId = String(req.body?.propertyId || "").trim();
    const unitId = String(req.body?.unitId || "").trim();
    const expectedStateToken = String(req.body?.expectedStateToken || "").trim();
    const idempotencyKey = String(req.body?.idempotencyKey || "").trim();
    if (!propertyId || !unitId || !expectedStateToken || !idempotencyKey) {
      return res.status(400).json({ ok: false, error: "resolution_context_required" });
    }
    const result = await resolveOccupancy({
      landlordId: landlordId(req),
      actorId: String(req.user?.id || req.user?.uid || landlordId(req)),
      propertyId,
      unitId,
      tenantId: String(req.body?.tenantId || "").trim() || null,
      type,
      expectedStateToken,
      idempotencyKey,
      confirmation: req.body?.confirmation === true,
      effectiveDate: String(req.body?.effectiveDate || "").trim() || null,
      selectedLeaseId: String(req.body?.selectedLeaseId || "").trim() || null,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    return handleError(res, error);
  }
});

export default router;
