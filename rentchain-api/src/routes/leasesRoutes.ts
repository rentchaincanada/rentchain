// src/routes/leaseRoutes.ts
import { Router, Request, Response } from "express";

const router = Router();

type Lease = {
  id: string;
  tenantId: string;
  propertyId: string;
  unit: string;
  startDate: string;
  endDate?: string | null;
  rent: number;
  status: "Active" | "NoticeGiven" | "Past";
};

// Temporary demo leases
const demoLeases: Lease[] = [
  {
    id: "lease-t1-2025",
    tenantId: "t1",
    propertyId: "p-main",
    unit: "101",
    startDate: "2025-01-01",
    endDate: null,
    rent: 1200,
    status: "Active",
  },
  {
    id: "lease-t2-2024",
    tenantId: "t2",
    propertyId: "p-main",
    unit: "102",
    startDate: "2024-06-01",
    endDate: "2025-05-31",
    rent: 1150,
    status: "Past",
  },
];

// GET /leases/tenant/t1
router.get("/tenant/:tenantId", (req: Request, res: Response) => {
  const { tenantId } = req.params;
  const leasesForTenant = demoLeases.filter((l) => l.tenantId === tenantId);
  return res.json(leasesForTenant);
});

export default router;
