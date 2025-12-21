import express, { Request, Response } from "express";

const router = express.Router();

// Later we’ll replace this with Firestore / real data
const MOCK_TENANTS = [
  {
    id: "t1",
    name: "John Smith",
    unit: "101",
    property: "Main St. Apartments",
    rent: 1450,
    balance: 0,
    riskScore: "Low",
    status: "Current – good standing",
    since: "Jan 2023",
  },
  {
    id: "t2",
    name: "Sarah Johnson",
    unit: "204",
    property: "Downtown Lofts",
    rent: 1650,
    balance: 450,
    riskScore: "Medium",
    status: "Late 15 days",
    since: "Jun 2024",
  },
  {
    id: "t3",
    name: "Ahmed Ali",
    unit: "3B",
    property: "Riverside Townhomes",
    rent: 1725,
    balance: 2100,
    riskScore: "High",
    status: "Delinquent 60+ days",
    since: "Sep 2022",
  },
];

router.get("/", async (_req: Request, res: Response) => {
  // In a later mission, this is where we'll:
  // - query Firestore for tenants
  // - join with payments to compute balance
  // - include risk signals
  res.json(MOCK_TENANTS);
});

export default router;
