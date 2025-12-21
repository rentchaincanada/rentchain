import { db } from "../firebase";
import { firestore } from "firebase-admin";

export interface PortfolioKpis {
  propertiesCount: number;
  totalUnits: number;
  occupiedUnits: number;
  vacancyCount: number;
  occupancyRate: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  mtdOutstanding: number;
  collectionRate: number;
}

export interface PropertyPortfolioSummary {
  propertyId: string;
  name: string;
  address: string;
  totalUnits: number;
  occupiedUnits: number;
  vacancyCount: number;
  occupancyRate: number;
  mtdRentCollected: number;
  mtdRentDue: number;
  collectionRate: number;
}

export interface PortfolioOverviewResponse {
  kpis: PortfolioKpis;
  properties: PropertyPortfolioSummary[];
}

type MutableSummary = {
  name: string;
  address: string;
  totalUnits: number;
  occupiedUnits: number;
  mtdRentCollected: number;
  mtdRentDue: number;
};

function normalizeDate(value: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const ts = value as firestore.Timestamp;
  if (ts && typeof ts.toDate === "function") {
    return ts.toDate();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function getPortfolioOverview(): Promise<PortfolioOverviewResponse> {
  // 1) Load all properties
  const propertiesSnap = await db.collection("properties").get();

  const propertyMeta = new Map<
    string,
    { name: string; address: string }
  >();

  propertiesSnap.forEach((doc) => {
    const data = doc.data() || {};
    propertyMeta.set(doc.id, {
      name:
        (data.name as string) ||
        (data.title as string) ||
        "Property",
      address: (data.address as string) || "",
    });
  });

  // 2) Aggregate units
  const unitsSnap = await db.collection("units").get();

  const perProperty: Record<string, MutableSummary> = {};
  let totalUnits = 0;
  let occupiedUnits = 0;

  unitsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const propertyId = (data.propertyId as string) || "unknown";

    if (!perProperty[propertyId]) {
      const meta = propertyMeta.get(propertyId) || {
        name: "Property",
        address: "",
      };
      perProperty[propertyId] = {
        name: meta.name,
        address: meta.address,
        totalUnits: 0,
        occupiedUnits: 0,
        mtdRentCollected: 0,
        mtdRentDue: 0,
      };
    }

    const summary = perProperty[propertyId];

    summary.totalUnits += 1;
    totalUnits += 1;

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
      summary.occupiedUnits += 1;
      occupiedUnits += 1;
    }
  });

  // 3) Aggregate MTD rent across portfolio
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthStart = new Date(year, month, 1);
  const nextMonthStart = new Date(year, month + 1, 1);

  const paymentsSnap = await db.collection("rentPayments").get();

  let mtdRentDue = 0;
  let mtdRentCollected = 0;

  paymentsSnap.forEach((doc) => {
    const data = doc.data() || {};
    const propertyId = (data.propertyId as string) || "unknown";

    const dueDate = normalizeDate(data.dueDate);
    if (!dueDate || dueDate < monthStart || dueDate >= nextMonthStart) {
      return;
    }

    if (!perProperty[propertyId]) {
      const meta = propertyMeta.get(propertyId) || {
        name: "Property",
        address: "",
      };
      perProperty[propertyId] = {
        name: meta.name,
        address: meta.address,
        totalUnits: 0,
        occupiedUnits: 0,
        mtdRentCollected: 0,
        mtdRentDue: 0,
      };
    }

    const summary = perProperty[propertyId];

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
    summary.mtdRentDue += expected;

    const hasPaid =
      !!data.paidAt ||
      !!data.paid_at ||
      (typeof data.isPaid === "boolean" && data.isPaid);

    if (hasPaid) {
      mtdRentCollected += paidAmount;
      summary.mtdRentCollected += paidAmount;
    }
  });

  const vacancyCount = Math.max(0, totalUnits - occupiedUnits);
  const occupancyRate =
    totalUnits > 0 ? occupiedUnits / totalUnits : 0;
  const collectionRate =
    mtdRentDue > 0 ? mtdRentCollected / mtdRentDue : 1;

  const properties: PropertyPortfolioSummary[] = Object.entries(
    perProperty
  ).map(([propertyId, s]) => {
    const vacancy = Math.max(0, s.totalUnits - s.occupiedUnits);
    const occRate =
      s.totalUnits > 0 ? s.occupiedUnits / s.totalUnits : 0;
    const propCollectionRate =
      s.mtdRentDue > 0 ? s.mtdRentCollected / s.mtdRentDue : 1;

    return {
      propertyId,
      name: s.name,
      address: s.address,
      totalUnits: s.totalUnits,
      occupiedUnits: s.occupiedUnits,
      vacancyCount: vacancy,
      occupancyRate: occRate,
      mtdRentCollected: s.mtdRentCollected,
      mtdRentDue: s.mtdRentDue,
      collectionRate: propCollectionRate,
    };
  });

  const kpis: PortfolioKpis = {
    propertiesCount: propertiesSnap.size,
    totalUnits,
    occupiedUnits,
    vacancyCount,
    occupancyRate,
    mtdRentCollected,
    mtdRentDue,
    mtdOutstanding: Math.max(0, mtdRentDue - mtdRentCollected),
    collectionRate,
  };

  return {
    kpis,
    properties,
  };
}
