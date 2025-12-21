// src/services/propertyOverview.ts
import { db } from "../config/firestore";
import { firestore } from "firebase-admin";

export interface PropertyOverviewKpis {
  occupancyRate: number;
  occupiedUnits: number;
  totalUnits: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  mtdOutstanding: number;
  collectionRate: number;
}

export type RiskLevel = "Low" | "Medium" | "High" | "Unknown";

export interface PropertyOverviewUnit {
  unit: string;
  tenant: string | null;
  rent: number | null;
  status: string;
  leaseEnd: string | null; // ISO date string YYYY-MM-DD
  risk: RiskLevel;
}

export interface MaintenanceSummary {
  openTickets: number;
  recentActivity: any[];
  aiInsights: any | null;
}

export interface PropertyOverviewResponse {
  propertyId: string;
  name: string;
  address: string;
  kpis: PropertyOverviewKpis;
  units: PropertyOverviewUnit[];
  maintenanceSummary: MaintenanceSummary;
}

export interface PropertySummary {
  id: string;
  name: string;
  address: string;
  occupancyRate?: number;   // 0 to 1
  collectionRate?: number;  // 0 to 1
  totalUnits?: number;
};

/**
 * Safely convert Firestore Timestamp → YYYY-MM-DD
 */
function toDateString(value: any): string | null {
  if (!value) return null;
  const ts = value as firestore.Timestamp;
  const date =
    ts instanceof Date ? ts : ts.toDate ? ts.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export async function getPropertyOverview(
  propertyId: string
): Promise<PropertyOverviewResponse> {
  // 1. Load property
  const propertySnap = await db.collection("properties").doc(propertyId).get();
  if (!propertySnap.exists) {
    throw new Error(`Property ${propertyId} not found`);
  }

  const propertyData = propertySnap.data() || {};
  const name: string =
    (propertyData.name as string) || (propertyData.title as string) || "Property";
  const address: string = (propertyData.address as string) || "";

  // 2. Units
  const unitsSnap = await db
    .collection("units")
    .where("propertyId", "==", propertyId)
    .get();

  const totalUnits = unitsSnap.size;
  let occupiedUnits = 0;
  const units: PropertyOverviewUnit[] = [];

  unitsSnap.forEach((doc) => {
    const data = doc.data();
    const tenantName =
      (data.tenantName as string) ||
      (data.tenant as string) ||
      null;

    const status: string =
      (data.status as string) ||
      (tenantName ? "Occupied" : "Vacant");

    const isVacant =
      status.toLowerCase() === "vacant" || !tenantName;

    if (!isVacant) {
      occupiedUnits += 1;
    }

    const rent =
      typeof data.rent === "number"
        ? (data.rent as number)
        : null;

    const risk =
      (data.riskLevel as RiskLevel) ||
      (data.risk as RiskLevel) ||
      "Unknown";

    units.push({
      unit: (data.unitNumber as string) || doc.id,
      tenant: tenantName,
      rent,
      status,
      leaseEnd: toDateString(data.leaseEnd),
      risk,
    });
  });

  const occupancyRate =
    totalUnits > 0 ? occupiedUnits / totalUnits : 0;

  // 3. MTD Rent (no composite index needed)
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-based
  const monthStart = new Date(year, month, 1);
  const nextMonthStart = new Date(year, month + 1, 1);

  const paymentsSnap = await db
    .collection("rentPayments")
    .where("propertyId", "==", propertyId)
    .get();

  let mtdRentDue = 0;
  let mtdRentCollected = 0;

  paymentsSnap.forEach((doc) => {
    const data = doc.data();

    // Normalize dueDate
    let due: Date | null = null;
    const rawDue = data.dueDate;
    if (rawDue instanceof Date) {
      due = rawDue;
    } else if (rawDue?.toDate) {
      due = rawDue.toDate();
    }

    // Only include current month
    if (!due || due < monthStart || due >= nextMonthStart) {
      return;
    }

    const expected =
      typeof data.expectedAmount === "number"
        ? (data.expectedAmount as number)
        : typeof data.amount === "number"
        ? (data.amount as number)
        : 0;

    const paidAmount =
      typeof data.amountPaid === "number"
        ? (data.amountPaid as number)
        : typeof data.amount === "number"
        ? (data.amount as number)
        : 0;

    mtdRentDue += expected;

    const hasPaid =
      !!data.paidAt ||
      !!data.paid_at ||
      (typeof data.isPaid === "boolean" && data.isPaid);

    if (hasPaid) {
      mtdRentCollected += paidAmount;
    }
  });

  const mtdOutstanding = Math.max(0, mtdRentDue - mtdRentCollected);
  const collectionRate =
    mtdRentDue > 0 ? mtdRentCollected / mtdRentDue : 1;

  const kpis: PropertyOverviewKpis = {
    occupancyRate,
    occupiedUnits,
    totalUnits,
    mtdRentCollected,
    mtdRentDue,
    mtdOutstanding,
    collectionRate,
  };

  // 4. Maintenance summary
  let openTickets = 0;

  try {
    const ticketsSnap = await db
      .collection("maintenanceTickets")
      .where("propertyId", "==", propertyId)
      .where("status", "in", ["Open", "In progress"])
      .get();

    openTickets = ticketsSnap.size;
  } catch (err) {
    console.warn(
      "[getPropertyOverview] maintenanceTickets query failed:",
      (err as Error).message
    );
  }

  const maintenanceSummary: MaintenanceSummary = {
    openTickets,
    recentActivity: [],
    aiInsights: null,
  };

  return {
    propertyId,
    name,
    address,
    kpis,
    units,
    maintenanceSummary,
  };
}

export async function listProperties(): Promise<PropertySummary[]> {
  const snap = await db.collection("properties").get();

  const items: PropertySummary[] = [];
  snap.forEach((doc) => {
    const data = doc.data() || {};
    items.push({
      id: doc.id,
      name:
        (data.name as string) ||
        (data.title as string) ||
        "Property",
      address: (data.address as string) || "",
    });
  });

  items.sort((a, b) => a.name.localeCompare(b.name));
  return items;
}
