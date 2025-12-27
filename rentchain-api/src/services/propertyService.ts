// @ts-nocheck
import crypto from "crypto";
import { db } from "../config/firebase";

export interface Unit {
  id: string;
  unitNumber: string;
  status: "vacant" | "occupied";
  rent: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  utilitiesIncluded?: string[];
}

export interface Property {
  id: string;
  name: string;
  landlordId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  managerEmail?: string;
  totalUnits: number;
  amenities?: string[];
  units: Unit[];
  createdAt: string;
  status: "draft" | "active";
}

export interface UnitPayload {
  unitNumber: string;
  rent: number;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sqft?: number | null;
  utilitiesIncluded?: string[];
}

export interface CreatePropertyPayload {
  name?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  province?: string;
  postalCode?: string;
  country?: string;
  managerEmail?: string;
  totalUnits: number;
  amenities?: string[];
  units?: UnitPayload[];
  landlordId: string;
  status?: "draft" | "active";
}

const COLLECTION = "properties";
const properties: Property[] = [];

export const propertyService = {
  getAll(landlordId?: string): Property[] {
    if (!landlordId) return properties;
    return properties.filter((p) => p.landlordId === landlordId);
  },

  getById(id: string): Property | undefined {
    return properties.find((p) => p.id === id);
  },

  async create(payload: CreatePropertyPayload): Promise<Property> {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const baseUnits =
      payload.units && payload.units.length > 0
        ? payload.units
        : Array.from({ length: Math.max(1, payload.totalUnits || 0) }, (_, idx) => ({
            unitNumber: `Unit ${idx + 1}`,
            rent: 0,
          }));

    const totalUnits =
      typeof payload.totalUnits === "number" && payload.totalUnits > 0
        ? payload.totalUnits
        : baseUnits.length;

    const units: Unit[] = baseUnits.map((u) => ({
      id: crypto.randomUUID(),
      unitNumber: String(u.unitNumber ?? "").trim() || "Unit",
      status: "vacant",
      rent: Number(u.rent ?? 0),
      bedrooms: u.bedrooms ?? null,
      bathrooms: u.bathrooms ?? null,
      sqft: u.sqft ?? null,
      utilitiesIncluded: u.utilitiesIncluded ?? [],
    }));

    const property: Property = {
      id,
      name: payload.name || payload.addressLine1,
      landlordId: payload.landlordId,
      addressLine1: payload.addressLine1,
      addressLine2: payload.addressLine2,
      city: payload.city,
      province: payload.province,
      postalCode: payload.postalCode,
      country: payload.country || "Canada",
      managerEmail: payload.managerEmail,
      totalUnits,
      amenities: payload.amenities ?? [],
      units,
      createdAt,
      status: payload.status || "active",
    };

    await db.collection(COLLECTION).doc(id).set(property);

    return property;
  },

  async createPropertyWithUnits(payload: CreatePropertyPayload): Promise<Property> {
    return this.create(payload);
  },

  listPropertiesForLandlord(landlordId: string): Array<
    Property & {
      unitCount: number;
      occupiedCount: number;
      occupancyRate: number;
    }
  > {
    const all = this.getAll(landlordId);
    return all.map((p) => {
      const unitCount = Array.isArray(p.units) ? p.units.length : p.totalUnits || 0;
      const occupiedCount = Array.isArray(p.units)
        ? p.units.filter((u) => u.status === "occupied").length
        : 0;
      const occupancyRate = unitCount > 0 ? occupiedCount / unitCount : 0;
      return {
        ...p,
        unitCount,
        occupiedCount,
        occupancyRate,
      };
    });
  },
};
