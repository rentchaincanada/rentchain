// src/routes/dashboardRoutes.ts
import { Router, Response, Request } from "express";
import { authenticateJwt } from "../middleware/authMiddleware";
import { db } from "../config/firebase";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

/** ---------- Types ---------- */

type PropertySummary = {
  id: string;
  name: string;
  city: string;
  units: number;
  occupiedUnits: number;
  occupancyRate: number; // 0–1
  avgRent: number;
  risk: "Low" | "Medium" | "High";
};

type TenantRiskRow = {
  id: string;
  name: string;
  propertyName: string;
  unitLabel: string;
  monthlyRent: number;
  onTimePayments: number;
  latePayments: number;
  riskLevel: "Low" | "Medium" | "High";
  rentChainScore: number;
};

type TimeSeriesPoint = {
  label: string;
  value: number;
};

type PaymentBreakdown = {
  onTime: number;
  gracePeriod: number;
  late: number;
  veryLate: number;
};

type DashboardOverviewResponse = {
  kpis: {
    totalProperties: number;
    totalUnits: number;
    occupancyRate: number; // 0–1
    monthlyRentRoll: number;
    monthlyCollected: number;
    monthlyDelinquent: number;
    occupiedUnits: number;
    activeLeases: number;
    portfolioValue: number;
    portfolioValueMode?: "placeholder" | "computed";
  };
  properties: PropertySummary[];
  tenantRisk: TenantRiskRow[];
  rentCollectionSeries: TimeSeriesPoint[];
  applicationsSeries: TimeSeriesPoint[];
  paymentBreakdown: PaymentBreakdown;
};

/** ---------- GET /dashboard/overview ---------- */

router.get("/overview", authenticateJwt, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const landlordId = req.user?.landlordId || req.user?.id;
    if (!landlordId) return res.status(401).json({ error: "Unauthorized" });

    // Properties snapshot
    const propsSnap = await db
      .collection("properties")
      .where("landlordId", "==", landlordId)
      .get();

    const propertiesRaw = propsSnap.docs.map((d) => d.data() as any);

    // Units snapshot (portfolio-wide)
    const unitsSnap = await db.collection("units").where("landlordId", "==", landlordId).get();
    const unitsRaw = unitsSnap.docs.map((d) => d.data() as any);

    // Leases snapshot (portfolio-wide)
    const leasesSnap = await db.collection("leases").where("landlordId", "==", landlordId).get();
    const leasesRaw = leasesSnap.docs.map((d) => d.data() as any);

    const activeLeases = leasesRaw.filter((l: any) => {
      const status = String(l.status || "").toLowerCase();
      if (status === "active") return true;
      if (l.endDate) {
        const end = new Date(l.endDate).getTime();
        if (!Number.isNaN(end) && end >= Date.now()) return true;
      }
      return false;
    });

    const totalProperties = propsSnap.size;
    const unitsCount = unitsRaw.length;
    const occupiedByLease = new Set<string>();
    activeLeases.forEach((l: any) => {
      const unitKey = l.unitId || `${l.propertyId || ""}__${l.unitNumber || ""}`;
      if (unitKey) occupiedByLease.add(String(unitKey));
    });
    const occupiedUnitsViaLease = occupiedByLease.size;
    const occupiedByStatus = unitsRaw.filter((u) => String(u.status || "").toLowerCase() === "occupied").length;
    const occupiedUnitsCount =
      activeLeases.length > 0 ? occupiedUnitsViaLease : occupiedByStatus;
    const occupancyRate = unitsCount > 0 ? occupiedUnitsCount / unitsCount : 0;

    // monthlyRentRoll prefers leases; fallback to occupied units' market rent
    let monthlyRentRoll = 0;
    if (activeLeases.length > 0) {
      monthlyRentRoll =
        activeLeases.reduce(
          (sum, l) =>
            sum +
            (typeof l.rentMonthlyCents === "number"
              ? l.rentMonthlyCents / 100
              : typeof l.monthlyRent === "number"
              ? l.monthlyRent
              : 0),
          0
        ) || 0;
    } else {
      monthlyRentRoll =
        unitsRaw
          .filter((u) => String(u.status || "").toLowerCase() === "occupied")
          .reduce(
            (sum, u) =>
              sum +
              (typeof u.marketRentCents === "number"
                ? u.marketRentCents / 100
                : typeof u.rent === "number"
                ? u.rent
                : 0),
            0
          ) || 0;
    }

    const monthlyCollected = 0; // placeholder until payments wired
    const monthlyDelinquent = Math.max(0, monthlyRentRoll - monthlyCollected);
    const portfolioValue = 0;
    const portfolioValueMode: "placeholder" | "computed" = "placeholder";

    const properties: PropertySummary[] = propertiesRaw.map((p: any) => {
      const propUnits = unitsRaw.filter((u) => u.propertyId === p.id);
      const propUnitCount = propUnits.length || p.totalUnits || 0;
      const propLeases = activeLeases.filter((l: any) => l.propertyId === p.id);
      const propOccupiedViaLease = new Set(
        propLeases.map((l: any) => l.unitId || `${l.propertyId || ""}__${l.unitNumber || ""}`)
      ).size;
      const propOccupiedStatus = propUnits.filter(
        (u) => String(u.status || "").toLowerCase() === "occupied"
      ).length;
      const propOccupied = propLeases.length > 0 ? propOccupiedViaLease : propOccupiedStatus;
      const occRate = propUnitCount > 0 ? propOccupied / propUnitCount : 0;
      const avgRent =
        propUnits.length > 0
          ? propUnits.reduce(
              (sum, u) =>
                sum +
                (typeof u.marketRentCents === "number"
                  ? u.marketRentCents / 100
                  : typeof u.rent === "number"
                  ? u.rent
                  : 0),
              0
            ) / propUnits.length
          : 0;
      return {
        id: p.id,
        name: p.name || p.addressLine1 || "Property",
        city: p.city || "",
        units: propUnitCount,
        occupiedUnits: propOccupied,
        occupancyRate: occRate,
        avgRent,
        risk: "Low",
      };
    });

    const kpis: DashboardOverviewResponse["kpis"] = {
      totalProperties,
      totalUnits: unitsCount,
      occupancyRate,
      monthlyRentRoll,
      monthlyCollected,
      monthlyDelinquent,
      occupiedUnits: occupiedUnitsCount,
      activeLeases: activeLeases.length,
      portfolioValue,
      portfolioValueMode,
    };

    const tenantRisk: TenantRiskRow[] = [
    {
      id: "t-alex-johnson",
      name: "Alex Johnson",
      propertyName: "Main St. Apartments",
      unitLabel: "Unit 203",
      monthlyRent: 1450,
      onTimePayments: 11,
      latePayments: 1,
      riskLevel: "Medium",
      rentChainScore: 705,
    },
    {
      id: "t-maria-lopez",
      name: "Maria Lopez",
      propertyName: "Downtown Lofts",
      unitLabel: "Unit 504",
      monthlyRent: 1650,
      onTimePayments: 9,
      latePayments: 3,
      riskLevel: "High",
      rentChainScore: 655,
    },
    {
      id: "t-jordan-patel",
      name: "Jordan Patel",
      propertyName: "Riverside Townhomes",
      unitLabel: "Unit 11B",
      monthlyRent: 1725,
      onTimePayments: 7,
      latePayments: 5,
      riskLevel: "High",
      rentChainScore: 605,
    },
  ];

    const rentCollectionSeries: TimeSeriesPoint[] = [
    { label: "Aug", value: 0.91 },
    { label: "Sep", value: 0.94 },
    { label: "Oct", value: 0.96 },
    { label: "Nov", value: 0.93 },
  ];

    const applicationsSeries: TimeSeriesPoint[] = [
    { label: "Aug", value: 18 },
    { label: "Sep", value: 22 },
    { label: "Oct", value: 19 },
    { label: "Nov", value: 25 },
  ];

    const paymentBreakdown: PaymentBreakdown = {
    onTime: 72,
    gracePeriod: 9,
    late: 6,
    veryLate: 3,
  };

    const response: DashboardOverviewResponse = {
      kpis,
      properties,
      tenantRisk,
      rentCollectionSeries,
      applicationsSeries,
      paymentBreakdown,
    };

    res.json(response);
  } catch (err) {
    console.error("[GET /dashboard/overview] error", err);
    res.status(500).json({ error: "Failed to load dashboard overview" });
  }
});

/** ---------- POST /dashboard/ai-insights ---------- */

router.post("/ai-insights", (req: Request, res: Response) => {
  const { selectedPropertyName, timeRange } = req.body || {};

  const propertyLabel =
    selectedPropertyName && selectedPropertyName.trim()
      ? selectedPropertyName
      : "all properties";

  const rangeLabel = timeRange || "the selected period";

  const insights = [
    {
      id: "ai-1",
      type: "info" as const,
      message: `Review rent collection trends for ${propertyLabel} over ${rangeLabel} to detect early patterns.`,
    },
    {
      id: "ai-2",
      type: "opportunity" as const,
      message:
        "Consider small incentives for early rent payment to improve collection speed.",
    },
    {
      id: "ai-3",
      type: "warning" as const,
      message:
        "Monitor tenants with repeated late payments to prevent delinquency escalation.",
    },
  ];

  res.json({ insights });
});

export default router;
