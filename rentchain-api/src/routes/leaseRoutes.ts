import { Router, Request, Response } from "express";
import {
  CreateLeasePayload,
  leaseService,
  UpdateLeasePayload,
} from "../services/leaseService";
import { requireCapability } from "../services/capabilityGuard";

const router = Router();

async function enforceLeaseCapability(req: any, res: Response): Promise<boolean> {
  const landlordId = req.user?.landlordId || req.user?.id;
  if (!landlordId) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  const cap = await requireCapability(landlordId, "leases");
  if (!cap.ok) {
    res.status(403).json({ error: "Upgrade required", capability: "leases", plan: cap.plan });
    return false;
  }
  return true;
}

router.get("/", (_req: Request, res: Response) => {
  const leases = leaseService.getAll();
  res.json({ leases });
});

router.get("/:id", (req: Request, res: Response) => {
  const lease = leaseService.getById(req.params.id);
  if (!lease) {
    return res.status(404).json({ error: "Lease not found" });
  }
  res.json({ lease });
});

router.get("/tenant/:tenantId", (req: Request, res: Response) => {
  const { tenantId } = req.params;
  if (!tenantId) {
    return res.status(400).json({ error: "tenantId is required" });
  }
  const leases = leaseService.getByTenantId(tenantId);
  res.json({ leases });
});

router.get("/property/:propertyId", (req: Request, res: Response) => {
  const { propertyId } = req.params;
  if (!propertyId) {
    return res.status(400).json({ error: "propertyId is required" });
  }
  const leases = leaseService.getByPropertyId(propertyId);
  res.json({ leases });
});

router.post("/", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const body = req.body as Partial<CreateLeasePayload>;
    if (!body.tenantId || !body.propertyId || !body.unitNumber) {
      return res.status(400).json({
        error: "tenantId, propertyId, and unitNumber are required",
      });
    }
    if (
      typeof body.monthlyRent !== "number" ||
      Number.isNaN(Number(body.monthlyRent))
    ) {
      return res.status(400).json({ error: "monthlyRent must be a number" });
    }
    if (!body.startDate) {
      return res.status(400).json({ error: "startDate is required" });
    }

    const existingActive = leaseService.getActiveByPropertyAndUnit(
      body.propertyId,
      body.unitNumber
    );
    if (existingActive) {
      return res.status(400).json({
        error: "An active lease already exists for this property and unit",
      });
    }

    const payload: CreateLeasePayload = {
      tenantId: body.tenantId,
      propertyId: body.propertyId,
      unitNumber: body.unitNumber,
      monthlyRent: Number(body.monthlyRent),
      startDate: body.startDate,
      endDate: body.endDate,
    };

    const lease = leaseService.create(payload);
    res.status(201).json({ lease });
  } catch (err) {
    console.error("[POST /api/leases] error", err);
    res.status(500).json({ error: "Failed to process lease" });
  }
});

router.put("/:id", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const payload = req.body as UpdateLeasePayload;
    const lease = leaseService.update(req.params.id, payload);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[PUT /api/leases/:id] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

router.post("/:id/end", async (req: Request, res: Response) => {
  try {
    if (!(await enforceLeaseCapability(req, res))) return;
    const endDate: string = req.body?.endDate || new Date().toISOString();
    const lease = leaseService.endLease(req.params.id, endDate);
    if (!lease) {
      return res.status(404).json({ error: "Lease not found" });
    }
    return res.json({ lease });
  } catch (err) {
    console.error("[POST /api/leases/:id/end] error", err);
    return res.status(500).json({ error: "Failed to process lease" });
  }
});

export default router;
